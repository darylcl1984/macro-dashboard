"""
fetch_macro.py
Fetches macro indicators and writes to data/macro.json.

Sources:
  - FRED (API key):    US M2, 10Y, USD Broad Index, HY OAS, Fed BS, RRP, TGA
  - ECB Data Portal:   Eurozone M2 (no key)
  - BoE IADB CSV:      UK M4 (no key)
  - BOJ REST API:      Japan M2
  - Stooq / Yahoo:     FX rates for the M2 composite
  - Alternative.me:    Crypto Fear & Greed Index (no key)

Manual data (hand-edited in data/manual.json):
  - China M2, scenario, CB gold, COFER, AI transition, manual triggers
"""

import csv
import io
import json
import os
from datetime import datetime, timedelta, timezone

from utils import (
    DATA_DIR,
    fetch_json,
    fetch_stooq,
    fetch_text,
    fetch_yahoo_quote,
    now_utc,
    write_json,
)

FRED_API_KEY = os.environ.get("FRED_API_KEY", "")
OUTPUT_FILE = DATA_DIR / "macro.json"
MANUAL_FILE = DATA_DIR / "manual.json"
M2_HISTORY_FILE = DATA_DIR / "m2_history.json"

# Browser-like UA for BoE (rejects default python UAs)
_BOE_UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/csv,text/plain,*/*",
}


# ---------------------------------------------------------------------------
# FRED
# ---------------------------------------------------------------------------

def fred_observations(series_id, limit=24):
    """Return list of (value, date) newest-first, skipping nulls."""
    if not FRED_API_KEY:
        raise RuntimeError("FRED_API_KEY not set")
    data = fetch_json(
        "https://api.stlouisfed.org/fred/series/observations",
        params={
            "series_id": series_id,
            "api_key": FRED_API_KEY,
            "file_type": "json",
            "sort_order": "desc",
            "limit": limit,
        },
    )
    out = []
    for obs in data["observations"]:
        if obs["value"] != ".":
            out.append((float(obs["value"]), obs["date"]))
    if not out:
        raise ValueError(f"No valid observations for FRED series {series_id}")
    return out


def fred_latest(series_id):
    """Return (value, date) for the most recent non-null observation."""
    value, date = fred_observations(series_id, limit=10)[0]
    return value, date


def _yoy_from_obs(obs):
    """
    obs: newest-first list of (value, date).
    Returns (yoy_pct, prior_yoy_pct, history_oldest_first) for monthly series.
    """
    if len(obs) < 13:
        return None, None, []
    # history oldest→newest for transmission strip (last 18 months max)
    hist = [{"period": d[:7], "value": v} for v, d in reversed(obs[:18])]
    cur_v, cur_d = obs[0]
    # find observation ~12 months earlier
    prior = None
    for v, d in obs[1:]:
        if d[:7] <= _shift_month(cur_d[:7], -12):
            prior = (v, d)
            break
    if prior is None and len(obs) >= 13:
        prior = obs[12]
    yoy = None
    if prior and prior[0]:
        yoy = round((cur_v / prior[0] - 1) * 100, 2)
    prior_yoy = None
    if len(obs) >= 14:
        # YoY as of previous month
        p_cur = obs[1]
        p_base = None
        for v, d in obs[2:]:
            if d[:7] <= _shift_month(p_cur[1][:7], -12):
                p_base = (v, d)
                break
        if p_base is None and len(obs) >= 14:
            p_base = obs[13]
        if p_base and p_base[0]:
            prior_yoy = round((p_cur[0] / p_base[0] - 1) * 100, 2)
    return yoy, prior_yoy, hist


def _shift_month(yyyy_mm, delta):
    y, m = map(int, yyyy_mm.split("-"))
    m += delta
    while m <= 0:
        m += 12
        y -= 1
    while m > 12:
        m -= 12
        y += 1
    return f"{y:04d}-{m:02d}"


def fetch_fred():
    results = {}
    series = {
        "US_M2":     "M2SL",         # billions USD, monthly
        "US_10Y":    "DGS10",        # percent, daily
        "USD_INDEX": "DTWEXBGS",     # Fed broad trade-weighted, daily
        "HY_OAS":    "BAMLH0A0HYM2", # HY option-adjusted spread, %, daily
        "FED_BS":    "WALCL",        # Fed total assets, $M weekly
        "RRP":       "RRPONTSYD",    # Overnight RRP, $B daily
        "TGA":       "WTREGEN",      # Treasury General Account, $M weekly (converted to $B below)
    }
    for label, sid in series.items():
        try:
            if label == "US_M2":
                obs = fred_observations(sid, limit=24)
                value, date = obs[0]
                yoy, prior_yoy, hist = _yoy_from_obs(obs)
                entry = {
                    "value": value,
                    "date": date,
                    "unit": "billions_usd",
                }
                if yoy is not None:
                    entry["yoy_pct"] = yoy
                if prior_yoy is not None:
                    entry["yoy_prior_pct"] = prior_yoy
                    entry["yoy_delta_pp"] = round(yoy - prior_yoy, 2) if yoy is not None else None
                if hist:
                    entry["history"] = hist
                results[label] = entry
                print(f"    {label}: {value} ({date}) yoy={yoy} Δpp={entry.get('yoy_delta_pp')}")
                continue

            value, date = fred_latest(sid)
            if label == "TGA":
                value = round(value / 1000.0, 3)  # WTREGEN is millions USD; normalize to $B
            entry = {"value": value, "date": date}
            if label == "HY_OAS":
                entry["unit"] = "pct"
            elif label == "FED_BS":
                entry["unit"] = "millions_usd"
            elif label in ("RRP", "TGA"):
                entry["unit"] = "billions_usd"
            results[label] = entry
            print(f"    {label}: {value} ({date})")
        except Exception as e:
            print(f"  [WARN] FRED {label} ({sid}): {e}")

    # US net liquidity = WALCL($M)/1000 − RRP($B) − TGA($B), all in $B
    fed = results.get("FED_BS")
    rrp = results.get("RRP")
    tga = results.get("TGA")
    if fed and rrp and tga:
        net = fed["value"] / 1000.0 - rrp["value"] - tga["value"]
        if not 2000 <= net <= 10000:
            print(f"  [WARN] US_NET_LIQ {round(net, 1)} $B outside plausible 2000-10000 range — skipped (check series units)")
            return results
        results["US_NET_LIQ"] = {
            "value": round(net, 1),
            "date": max(fed["date"], rrp["date"], tga["date"]),
            "unit": "billions_usd",
            "components": {
                "FED_BS_bn": round(fed["value"] / 1000.0, 1),
                "RRP_bn": rrp["value"],
                "TGA_bn": tga["value"],
            },
        }
        print(f"    US_NET_LIQ: {results['US_NET_LIQ']['value']} $B")
    else:
        print("  [WARN] US_NET_LIQ: missing FED_BS/RRP/TGA — skipped")

    return results


# ---------------------------------------------------------------------------
# ECB — Eurozone M2
# ---------------------------------------------------------------------------

def fetch_ez_m2():
    """
    ECB Data Portal BSI M2 outstanding amounts (EUR millions) → trillions EUR.
    Series: M.U2.Y.V.M20.X.1.U2.2300.Z01.E
    """
    url = (
        "https://data-api.ecb.europa.eu/service/data/BSI/"
        "M.U2.Y.V.M20.X.1.U2.2300.Z01.E"
        "?lastNObservations=1&format=jsondata"
    )
    data = fetch_json(url, timeout=30)
    datasets = data.get("dataSets", [])
    if not datasets:
        raise ValueError("Empty ECB dataSets")
    series = datasets[0].get("series", {})
    if not series:
        raise ValueError("Empty ECB series")
    # Single series key; take its sole observation
    obs_map = next(iter(series.values())).get("observations", {})
    if not obs_map:
        raise ValueError("Empty ECB observations")
    raw = next(iter(obs_map.values()))[0]  # EUR millions
    if not (15_000_000 <= raw <= 17_000_000):
        # soft range from task; accept slightly wider then reject outside hard band
        if not (14_000_000 <= raw <= 18_000_000):
            raise ValueError(f"EZ_M2 out of range: {raw} EUR millions")
        print(f"  [WARN] EZ_M2 magnitude {raw} outside preferred 15–17M band (accepted)")

    # Time period from structure
    time_vals = (
        data.get("structure", {})
        .get("dimensions", {})
        .get("observation", [{}])[0]
        .get("values", [])
    )
    date = time_vals[0]["id"] if time_vals else None
    value_tn = round(raw / 1_000_000, 2)  # millions → trillions
    if not (14.0 <= value_tn <= 18.0):
        raise ValueError(f"EZ_M2 {value_tn}T outside €14–18T validation")
    return {"value": value_tn, "date": date, "unit": "trillions EUR"}


# ---------------------------------------------------------------------------
# BoE — UK M4
# ---------------------------------------------------------------------------

def fetch_uk_m4():
    """
    BoE IADB CSV for LPMAUYN (M4 SA, £ millions) → billions GBP.
    Note: endpoint path is database/_iadb-fromshowcolumns.asp (requires Datefrom/Dateto);
    the legacy iadb/fromshowcolumns.asp URL now returns an HTML error page.
    """
    year = datetime.now(timezone.utc).year
    url = (
        "https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp"
        f"?csv.x=yes&SeriesCodes=LPMAUYN&UsingCodes=Y&CSVF=TN"
        f"&Datefrom=01/Jan/{year - 2}&Dateto=31/Dec/{year}"
    )
    text = fetch_text(url, headers=_BOE_UA, timeout=30)
    if text.lstrip().startswith("<!") or "DATE" not in text[:80]:
        raise ValueError("BoE returned non-CSV (HTML error page?)")
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows:
        raise ValueError("Empty BoE CSV")
    last = rows[-1]
    raw = float(last["LPMAUYN"])  # £ millions
    if not (3_000_000 <= raw <= 3_600_000):
        raise ValueError(f"UK_M4 out of range: {raw} GBP millions")
    value_bn = round(raw / 1000.0, 1)  # millions → billions
    # Parse "31 May 2026" → "2026-05"
    try:
        dt = datetime.strptime(last["DATE"].strip(), "%d %b %Y")
        date = dt.strftime("%Y-%m")
    except ValueError:
        date = last["DATE"]
    return {"value": value_bn, "date": date, "unit": "billions GBP"}


# ---------------------------------------------------------------------------
# BOJ — Japan M2
# ---------------------------------------------------------------------------

def fetch_boj_m2():
    """Returns latest Japan M2 in trillions JPY."""
    start_date = (datetime.now() - timedelta(days=180)).strftime("%Y%m")
    data = fetch_json(
        "https://www.stat-search.boj.or.jp/api/v1/getDataCode",
        params={
            "format": "json",
            "lang": "en",
            "db": "MD02",
            "code": "MAM1NAM2M2MO",
            "startDate": start_date,
        },
        timeout=20,
    )
    resultset = data.get("RESULTSET", [])
    if not resultset:
        raise ValueError("Empty BOJ RESULTSET response")
    vals = resultset[0].get("VALUES", {})
    dates = vals.get("SURVEY_DATES", [])
    values = vals.get("VALUES", [])
    for date, val in zip(reversed(dates), reversed(values)):
        if val is not None:
            # Units: 100 million JPY → trillions
            return round(float(val) / 10000, 2), str(date)
    raise ValueError("No valid BOJ M2 observations")


def fetch_boj():
    results = {}
    try:
        value, date = fetch_boj_m2()
        results["JP_M2"] = {"value": value, "date": date, "unit": "trillions JPY"}
        print(f"    JP_M2: {value}T JPY ({date})")
    except Exception as e:
        print(f"  [WARN] BOJ M2: {e}")
    return results


# ---------------------------------------------------------------------------
# Crypto Fear & Greed — Alternative.me
# ---------------------------------------------------------------------------

def fetch_fear_greed():
    results = {}
    try:
        data = fetch_json("https://api.alternative.me/fng/?limit=1")
        entry = data["data"][0]
        results["FEAR_GREED"] = {
            "value": int(entry["value"]),
            "classification": entry["value_classification"],
            "date": datetime.fromtimestamp(
                int(entry["timestamp"]), tz=timezone.utc
            ).date().isoformat(),
        }
        print(f"    FEAR_GREED: {entry['value']} ({entry['value_classification']})")
    except Exception as e:
        print(f"  [WARN] Fear & Greed: {e}")
    return results


# ---------------------------------------------------------------------------
# FX rates for the composite
# ---------------------------------------------------------------------------

_FX_PAIRS = {
    # label: (stooq_sym, yahoo_sym)
    "EURUSD": ("eurusd", "EURUSD=X"),
    "GBPUSD": ("gbpusd", "GBPUSD=X"),
    "USDCNY": ("usdcny", "CNY=X"),
    "USDJPY": ("usdjpy", "JPY=X"),
}


def fetch_fx_rates():
    """Stooq primary, Yahoo chart-meta fallback. Returns {rate: {value, date, source}}."""
    today = datetime.now(timezone.utc).date().isoformat()
    fx = {}
    for label, (stooq_sym, yahoo_sym) in _FX_PAIRS.items():
        try:
            sq = fetch_stooq(stooq_sym)
            fx[label] = {"value": sq["price"], "date": today, "source": "stooq"}
            print(f"    {label}: {sq['price']} (stooq)")
            continue
        except Exception as e:
            print(f"  [WARN] Stooq {label}: {e}")
        try:
            price = fetch_yahoo_quote(yahoo_sym)
            fx[label] = {"value": price, "date": today, "source": "yahoo"}
            print(f"    {label}: {price} (yahoo)")
        except Exception as e:
            print(f"  [WARN] Yahoo FX {label}: {e}")
    return fx


# ---------------------------------------------------------------------------
# Global M2 composite + history / YoY
# ---------------------------------------------------------------------------

def _seed_m2_history():
    """Load m2_history.json, seeding the 2026-03 manual-era entry if absent."""
    history = []
    if M2_HISTORY_FILE.exists():
        try:
            history = json.loads(M2_HISTORY_FILE.read_text(encoding="utf-8"))
            if not isinstance(history, list):
                history = []
        except Exception:
            history = []
    periods = {e.get("period") for e in history}
    if "2026-03" not in periods:
        history.insert(0, {
            "period": "2026-03",
            "components_local": None,
            "fx": None,
            "composite_usd": 103.97,
        })
    return history


def compute_global_m2(indicators, manual, fx):
    """
    Build GLOBAL_M2 from five blocs. Returns (global_m2_dict, snapshot) or (None, None).
    Skips entirely if any component is missing — never writes a partial sum.
    """
    us = indicators.get("US_M2")
    jp = indicators.get("JP_M2")
    ez = indicators.get("EZ_M2")
    uk = indicators.get("UK_M4")
    cn = (manual or {}).get("china_m2")

    needed_fx = ("EURUSD", "GBPUSD", "USDCNY", "USDJPY")
    if not all(k in fx and fx[k].get("value") for k in needed_fx):
        print("  [WARN] GLOBAL_M2: missing FX rates — skipped")
        return None, None
    if not all([us, jp, ez, uk, cn and cn.get("value") is not None]):
        print("  [WARN] GLOBAL_M2: missing M2 component — skipped")
        return None, None

    eurusd = fx["EURUSD"]["value"]
    gbpusd = fx["GBPUSD"]["value"]
    usdcny = fx["USDCNY"]["value"]
    usdjpy = fx["USDJPY"]["value"]

    # Local → USD trillions
    us_usd = us["value"] / 1000.0                          # $B → $T
    cn_usd = cn["value"] / usdcny                          # ¥T / (¥/$)
    ez_usd = ez["value"] * eurusd                          # €T × $/€
    jp_usd = jp["value"] / usdjpy                          # ¥T / (¥/$)
    uk_usd = uk["value"] * gbpusd / 1000.0                 # £B × $/£ → $T

    components = {
        "US": round(us_usd, 2),
        "CN": round(cn_usd, 2),
        "EZ": round(ez_usd, 2),
        "JP": round(jp_usd, 2),
        "UK": round(uk_usd, 2),
    }
    total = round(sum(components.values()), 2)

    if not (90 <= total <= 125):
        print(f"  [WARN] GLOBAL_M2 {total}T outside $90–125T — skipped write")
        return None, None
    if not (95 <= total <= 120):
        print(f"  [WARN] GLOBAL_M2 {total}T outside preferred $95–120T (accepted)")

    component_dates = {
        "US": us.get("date"),
        "CN": cn.get("period") or cn.get("updated"),
        "EZ": ez.get("date"),
        "JP": jp.get("date"),
        "UK": uk.get("date"),
    }

    global_m2 = {
        "value": total,
        "unit": "trillions_usd",
        "components": components,
        "component_dates": component_dates,
        "computed_at": now_utc(),
    }

    period = datetime.now(timezone.utc).strftime("%Y-%m")
    snapshot = {
        "period": period,
        "components_local": {
            "US_usd_bn": us["value"],
            "CN_cny_tn": cn["value"],
            "EZ_eur_tn": ez["value"],
            "JP_jpy_tn": jp["value"],
            "UK_gbp_bn": uk["value"],
        },
        "fx": {k: fx[k]["value"] for k in needed_fx},
        "composite_usd": total,
    }
    print(f"    GLOBAL_M2: {total}T USD  components={components}")
    return global_m2, snapshot


def upsert_m2_history(snapshot):
    """Upsert current-month snapshot; compute YoY when 12-month-prior exists."""
    history = _seed_m2_history()
    period = snapshot["period"]

    # Upsert by period (overwrite within the month)
    replaced = False
    for i, entry in enumerate(history):
        if entry.get("period") == period:
            history[i] = snapshot
            replaced = True
            break
    if not replaced:
        history.append(snapshot)

    history.sort(key=lambda e: e.get("period") or "")
    write_json(M2_HISTORY_FILE, history)

    # YoY vs same month 12 months prior
    y, m = period.split("-")
    prior_period = f"{int(y) - 1}-{m}"
    prior = next((e for e in history if e.get("period") == prior_period), None)

    headline_pct = None
    fx_adjusted_pct = None

    if prior and prior.get("composite_usd") is not None:
        headline_pct = round(
            (snapshot["composite_usd"] / prior["composite_usd"] - 1) * 100, 2
        )

    prior_local = (prior or {}).get("components_local") if prior else None
    cur_fx = snapshot.get("fx") or {}
    if prior_local and all(prior_local.get(k) is not None for k in (
        "US_usd_bn", "CN_cny_tn", "EZ_eur_tn", "JP_jpy_tn", "UK_gbp_bn"
    )) and all(k in cur_fx for k in ("EURUSD", "GBPUSD", "USDCNY", "USDJPY")):
        # Revalue year-ago local components at *current* FX
        revalued = (
            prior_local["US_usd_bn"] / 1000.0
            + prior_local["CN_cny_tn"] / cur_fx["USDCNY"]
            + prior_local["EZ_eur_tn"] * cur_fx["EURUSD"]
            + prior_local["JP_jpy_tn"] / cur_fx["USDJPY"]
            + prior_local["UK_gbp_bn"] * cur_fx["GBPUSD"] / 1000.0
        )
        if revalued:
            fx_adjusted_pct = round(
                (snapshot["composite_usd"] / revalued - 1) * 100, 2
            )

    return {
        "headline_pct": headline_pct,
        "fx_adjusted_pct": fx_adjusted_pct,
        "base_period": prior_period if prior else None,
        "as_of_period": period,
    }


# ---------------------------------------------------------------------------
# Manual data passthrough
# ---------------------------------------------------------------------------

def load_manual():
    if MANUAL_FILE.exists():
        return json.loads(MANUAL_FILE.read_text(encoding="utf-8"))
    return {}


# ---------------------------------------------------------------------------
# Stablecoins (dollar rails proxy)
# ---------------------------------------------------------------------------

def fetch_stablecoins():
    """
    Aggregate stablecoin market cap via DefiLlama (no key).
    Returns STABLECOIN_MCAP in billions USD.
    """
    data = fetch_json("https://stablecoins.llama.fi/stablecoins?includePrices=true", timeout=30)
    pegged = data.get("peggedAssets") or []
    total = 0.0
    for asset in pegged:
        circ = (asset.get("circulating") or {}).get("peggedUSD")
        if circ is not None:
            total += float(circ)
    if total <= 0:
        raise ValueError("No stablecoin circulating totals")
    bn = round(total / 1e9, 1)
    return {
        "STABLECOIN_MCAP": {
            "value": bn,
            "unit": "billions_usd",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "source": "defillama",
        }
    }


def enrich_global_m2_yoy(yoy, history):
    """Attach history progress metadata for the dual M2 readout."""
    periods = [e.get("period") for e in history if e.get("period")]
    n = len(periods)
    yoy = dict(yoy or {})
    yoy["history_months"] = n
    yoy["history_ready"] = yoy.get("headline_pct") is not None
    yoy["history_needed"] = 13
    if not yoy.get("history_ready"):
        yoy["history_note"] = (
            f"Computed YoY needs ~13 months of history "
            f"({n} month{'s' if n != 1 else ''} on file)."
        )
    return yoy


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Fetching macro indicators...")

    # Seed from existing file so a failed fetch doesn't wipe previously good values
    existing: dict = {}
    if OUTPUT_FILE.exists():
        try:
            existing = json.loads(OUTPUT_FILE.read_text(encoding="utf-8")).get("indicators", {})
        except Exception:
            pass

    results = {
        "updated_at": now_utc(),
        "indicators": {k: v for k, v in existing.items() if k != "MANUAL"},
    }
    indicators = results["indicators"]

    print("  FRED: US M2, 10Y, USD Index, HY OAS, Fed BS / RRP / TGA")
    indicators.update(fetch_fred())

    print("  ECB: Eurozone M2")
    try:
        ez = fetch_ez_m2()
        indicators["EZ_M2"] = ez
        print(f"    EZ_M2: {ez['value']}T EUR ({ez['date']})")
    except Exception as e:
        print(f"  [WARN] ECB EZ_M2: {e}")

    print("  BoE: UK M4")
    try:
        uk = fetch_uk_m4()
        indicators["UK_M4"] = uk
        print(f"    UK_M4: {uk['value']}B GBP ({uk['date']})")
    except Exception as e:
        print(f"  [WARN] BoE UK_M4: {e}")

    print("  BOJ: Japan M2")
    indicators.update(fetch_boj())

    print("  Alternative.me: Fear & Greed")
    indicators.update(fetch_fear_greed())

    print("  FX: EURUSD, GBPUSD, USDCNY, USDJPY")
    fx = fetch_fx_rates()
    if fx:
        indicators["fx"] = fx
    elif "fx" not in indicators:
        print("  [WARN] No FX rates fetched")

    print("  Manual: china_m2, scenario, triggers, …")
    manual = load_manual()
    if manual:
        indicators["MANUAL"] = manual
    else:
        print("    [INFO] data/manual.json not found or empty — skipping")

    print("  Composite: Global M2")
    try:
        global_m2, snapshot = compute_global_m2(indicators, manual, indicators.get("fx", {}))
        if global_m2 and snapshot:
            indicators["GLOBAL_M2"] = global_m2
            yoy = upsert_m2_history(snapshot)
            hist = _seed_m2_history()
            indicators["GLOBAL_M2_YOY"] = enrich_global_m2_yoy(yoy, hist)
            print(f"    GLOBAL_M2_YOY: headline={yoy['headline_pct']} fx_adj={yoy['fx_adjusted_pct']}")
        else:
            # Ensure history seed file still exists even if composite skipped
            hist = _seed_m2_history()
            write_json(M2_HISTORY_FILE, hist)
            if "GLOBAL_M2_YOY" in indicators:
                indicators["GLOBAL_M2_YOY"] = enrich_global_m2_yoy(
                    indicators["GLOBAL_M2_YOY"], hist
                )
    except Exception as e:
        print(f"  [WARN] GLOBAL_M2: {e}")

    print("  Stablecoins: market cap (DefiLlama)")
    try:
        sc = fetch_stablecoins()
        indicators.update(sc)
        print(f"    STABLECOIN_MCAP: ${sc['STABLECOIN_MCAP']['value']}B")
    except Exception as e:
        print(f"  [WARN] Stablecoins: {e}")

    write_json(OUTPUT_FILE, results)
    print(f"Written to {OUTPUT_FILE}")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
