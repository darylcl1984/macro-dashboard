"""
fetch_macro.py
Fetches macro indicators and writes to data/macro.json.

Sources:
  - FRED (API key):    US M2 (M2SL), US 10Y Treasury (DGS10), US Dollar Index (DTWEXBGS)
  - ECB Data Portal:   Eurozone M2 (no key)
  - BOJ REST API:      Japan M2 (no key)
  - Alternative.me:    Crypto Fear & Greed Index (no key)

Manual data (quarterly updates by hand in data/manual.json):
  - CN M2, UK M2, Global M2 composite
"""

import json
import os
from datetime import datetime, timezone

from utils import DATA_DIR, SESSION, fetch_json, fetch_text, now_utc, write_json

FRED_API_KEY = os.environ.get("FRED_API_KEY", "")
OUTPUT_FILE = DATA_DIR / "macro.json"
MANUAL_FILE = DATA_DIR / "manual.json"


# ---------------------------------------------------------------------------
# FRED
# ---------------------------------------------------------------------------

def fred_latest(series_id):
    """Return (value, date) for the most recent non-null observation."""
    if not FRED_API_KEY:
        raise RuntimeError("FRED_API_KEY not set")
    data = fetch_json(
        "https://api.stlouisfed.org/fred/series/observations",
        params={
            "series_id": series_id,
            "api_key": FRED_API_KEY,
            "file_type": "json",
            "sort_order": "desc",
            "limit": 10,  # grab a few in case latest is null
        },
    )
    for obs in data["observations"]:
        if obs["value"] != ".":
            return float(obs["value"]), obs["date"]
    raise ValueError(f"No valid observations for FRED series {series_id}")


def fetch_fred():
    results = {}
    series = {
        "US_M2": "M2SL",          # billions USD, monthly
        "US_10Y": "DGS10",        # percent, daily
        "USD_INDEX": "DTWEXBGS",  # index, daily
    }
    for label, sid in series.items():
        try:
            value, date = fred_latest(sid)
            results[label] = {"value": value, "date": date}
            print(f"    {label}: {value} ({date})")
        except Exception as e:
            print(f"  [WARN] FRED {label} ({sid}): {e}")
    return results


# ---------------------------------------------------------------------------
# ECB — Eurozone M2
# ECB Statistical Data Warehouse REST API
# Series: BSI.M.U2.Y.V.M20.X.1.U2.2300.Z01.E
# ---------------------------------------------------------------------------

def fetch_ecb_m2():
    """Returns latest Eurozone M2 in billions EUR."""
    series_key = "BSI.M.U2.Y.V.M20.X.1.U2.2300.Z01.E"
    url = f"https://data-api.ecb.europa.eu/service/data/BSI/{series_key}"
    data = fetch_json(
        url,
        params={"lastNObservations": 3, "format": "jsondata"},
        headers={"Accept": "application/json"},
        timeout=20,
    )

    # Navigate ECB SDMX-JSON structure
    structure = data["structure"]
    obs_dim = structure["dimensions"]["observation"][0]  # time dimension
    periods = [p["id"] for p in obs_dim["values"]]

    dataset = data["dataSets"][0]
    series_data = dataset["series"]["0:0:0:0:0:0:0:0:0:0:0:0"]
    observations = series_data["observations"]

    # Find latest non-null
    for idx in sorted(observations.keys(), key=int, reverse=True):
        val = observations[idx][0]
        if val is not None:
            date = periods[int(idx)]
            # ECB reports in millions EUR — convert to billions
            return round(val / 1000, 2), date

    raise ValueError("No valid ECB M2 observations")


def fetch_ecb():
    results = {}
    try:
        value, date = fetch_ecb_m2()
        results["EUR_M2"] = {"value": value, "date": date, "unit": "billions EUR"}
        print(f"    EUR_M2: {value}B EUR ({date})")
    except Exception as e:
        print(f"  [WARN] ECB M2: {e}")
    return results


# ---------------------------------------------------------------------------
# BOJ — Japan M2
# BOJ REST API: https://www.stat-search.boj.or.jp/info/dload.html
# Series: MD01 (M2, end of month, 100 million yen)
# ---------------------------------------------------------------------------

def fetch_boj_m2():
    """Returns latest Japan M2 in trillions JPY."""
    # BOJ's time-series search API
    url = "https://www.stat-search.boj.or.jp/ssi/mtshtml/md01_m_1.html"
    # BOJ provides a REST-like CSV/JSON endpoint via their SDMX service
    # Use the compact JSON endpoint; if unavailable, caller falls back to CSV
    data = fetch_json(
        "https://www.stat-search.boj.or.jp/ssi/api/v1/dataflow/stat/MD01",
        timeout=20,
    )

    observations = data.get("observations", [])
    if not observations:
        raise ValueError("Empty BOJ response")

    # Sort descending by date and take first non-null
    for obs in sorted(observations, key=lambda x: x.get("date", ""), reverse=True):
        val = obs.get("value")
        if val is not None:
            # BOJ M2 is in 100 million JPY; convert to trillions
            return round(float(val) / 10000, 2), obs["date"]

    raise ValueError("No valid BOJ M2 observations")


def fetch_boj_m2_csv():
    """Fallback: fetch BOJ M2 via their e-Stat/CSV download."""
    # BOJ publishes M2 at a stable URL as a flat CSV
    url = "https://www.stat-search.boj.or.jp/ssi/mtshtml/md01_m_1_en.csv"
    lines = fetch_text(url, timeout=20).splitlines()
    # Find data rows: format is YYYY/MM,value,...
    for line in reversed(lines):
        parts = line.split(",")
        if len(parts) >= 2 and "/" in parts[0]:
            date_str = parts[0].strip().strip('"')
            val_str = parts[1].strip().strip('"').replace(",", "")
            if val_str and val_str not in ("", "ND"):
                try:
                    # Values are in 100 million JPY → trillions
                    val = round(float(val_str) / 10000, 2)
                    # Normalise date to YYYY-MM
                    date = date_str.replace("/", "-")
                    return val, date
                except ValueError:
                    continue

    raise ValueError("Could not parse BOJ CSV")


def fetch_boj():
    results = {}
    try:
        try:
            value, date = fetch_boj_m2()
        except Exception:
            print("    BOJ primary API failed, trying CSV fallback...")
            value, date = fetch_boj_m2_csv()
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
            "date": datetime.fromtimestamp(int(entry["timestamp"]), tz=timezone.utc).date().isoformat(),
        }
        print(f"    FEAR_GREED: {entry['value']} ({entry['value_classification']})")
    except Exception as e:
        print(f"  [WARN] Fear & Greed: {e}")
    return results


# ---------------------------------------------------------------------------
# Manual data passthrough
# ---------------------------------------------------------------------------

def load_manual():
    if MANUAL_FILE.exists():
        return json.loads(MANUAL_FILE.read_text())
    return {}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Fetching macro indicators...")

    results = {
        "updated_at": now_utc(),
        "indicators": {},
    }
    indicators = results["indicators"]

    print("  FRED: US M2, 10Y, USD Index")
    indicators.update(fetch_fred())

    print("  ECB: Eurozone M2")
    indicators.update(fetch_ecb())

    print("  BOJ: Japan M2")
    indicators.update(fetch_boj())

    print("  Alternative.me: Fear & Greed")
    indicators.update(fetch_fear_greed())

    print("  Manual: CN M2, UK M2, Global M2")
    manual = load_manual()
    if manual:
        indicators["MANUAL"] = manual
    else:
        print("    [INFO] data/manual.json not found or empty — skipping")

    write_json(OUTPUT_FILE, results)
    print(f"Written to {OUTPUT_FILE}")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
