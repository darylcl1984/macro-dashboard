"""
fetch_prices.py
Fetches latest price data and writes to data/prices.json.

Output schema:
  prices.<SYMBOL> = { "price": float | null, "change_pct": float | null,
                      "week52_low": float | null, "week52_high": float | null }
  fx.USDJPY = float

Sources:
  - CoinGecko (no key): BTC (includes 24h change)
  - Yahoo Finance:      XAUUSD (GC=F), WTI (CL=F), VIX — quote + 52-week in one call
  - Stooq (no key):     XAUUSD / WTI fallback; USDJPY FX
"""

import json
import sys
import time
from datetime import datetime

from utils import DATA_DIR, SESSION, fetch_json, fetch_stooq, now_utc, write_json

OUTPUT_FILE = DATA_DIR / "prices.json"

_YAHOO_UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}

# Yahoo chart symbols (URL-encoded where needed)
YAHOO_SYMBOLS = {
    "BTC":    "BTC-USD",
    "XAUUSD": "GC%3DF",    # GC=F
    "WTI":    "CL%3DF",    # CL=F
    "VIX":    "%5EVIX",    # ^VIX
}

# Stooq symbols used as quote fallback for gold/WTI, and for FX
STOOQ_QUOTE_FALLBACK = {
    "XAUUSD": "xauusd",
    "WTI":    "cl.f",
}


# ---------------------------------------------------------------------------
# CoinGecko — BTC with 24h change
# ---------------------------------------------------------------------------

def fetch_coingecko():
    data = fetch_json(
        "https://api.coingecko.com/api/v3/simple/price",
        params={
            "ids": "bitcoin",
            "vs_currencies": "usd",
            "include_24hr_change": "true",
        },
    )
    btc = data["bitcoin"]
    return {
        "BTC": {
            "price": btc["usd"],
            "change_pct": round(btc.get("usd_24h_change") or 0, 2),
        }
    }


# ---------------------------------------------------------------------------
# Stooq — USDJPY FX + gold/WTI quote fallback (via utils.fetch_stooq)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Yahoo Finance — quote + 52-week range in a single chart call
# ---------------------------------------------------------------------------

def fetch_yahoo_chart(ticker, yahoo_sym):
    """
    One Yahoo chart call → price, change_pct, week52_low, week52_high.
    Raises on hard failure; returns null-padded fields when meta is partial.
    """
    resp = SESSION.get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}",
        params={"interval": "1d", "range": "5d"},
        headers=_YAHOO_UA,
        timeout=15,
    )
    resp.raise_for_status()
    chart = resp.json()["chart"]["result"][0]["meta"]

    price = chart.get("regularMarketPrice")
    prev = chart.get("chartPreviousClose")
    change_pct = None
    if price is not None and prev:
        change_pct = round((price - prev) / prev * 100, 2)

    return {
        "price": float(price) if price is not None else None,
        "change_pct": change_pct,
        "week52_low": chart.get("fiftyTwoWeekLow"),
        "week52_high": chart.get("fiftyTwoWeekHigh"),
    }


def _yahoo_history(yahoo_sym, interval, range_):
    """Return list of {t, close} from Yahoo chart timestamps."""
    resp = SESSION.get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}",
        params={"interval": interval, "range": range_},
        headers=_YAHOO_UA,
        timeout=20,
    )
    resp.raise_for_status()
    result = resp.json()["chart"]["result"][0]
    ts = result.get("timestamp") or []
    closes = (result.get("indicators") or {}).get("quote", [{}])[0].get("close") or []
    out = []
    for t, c in zip(ts, closes):
        if c is None:
            continue
        out.append({"t": int(t), "close": float(c)})
    return out


def _bar_is_open(bar, kind, now):
    dt = datetime.utcfromtimestamp(bar["t"])
    if kind == "month":
        return (dt.year, dt.month) == (now.year, now.month)
    iso = dt.isocalendar()
    now_iso = now.isocalendar()
    same_week = (iso[0], iso[1]) == (now_iso[0], now_iso[1])
    # Mon–Thu: current ISO week is still open. Fri–Sun: Friday close stands.
    return same_week and now.weekday() < 4


def pick_completed_bar(bars, kind, now=None):
    """
    Last finished week or month bar — skip every in-progress Yahoo bar.

    Weekly: Mon–Thu the current ISO week is open. Fri–Sun accept this week's
    bar (US session has closed Friday).
    Monthly: skip every bar whose calendar month is still the current month.
    """
    now = now or datetime.utcnow()
    if not bars:
        return None
    for bar in reversed(bars):
        if _bar_is_open(bar, kind, now):
            continue
        return bar
    return None


def _round_close(ticker, close):
    return round(close, 0 if ticker == "BTC" else 2)


def enrich_closes(ticker, yahoo_sym, entry, now=None):
    """
    Attach weekly_close, monthly_close, and for BTC a monthly series for
    transmission vs money growth. Uses Yahoo history. Closes are last
    *completed* bars.
    """
    now = now or datetime.utcnow()
    try:
        weekly = _yahoo_history(yahoo_sym, "1wk", "3mo")
        if weekly:
            chosen = pick_completed_bar(weekly, "week", now=now)
            if chosen:
                entry["weekly_close"] = _round_close(ticker, chosen["close"])
                entry["weekly_close_as_of"] = datetime.utcfromtimestamp(
                    chosen["t"]
                ).strftime("%Y-%m-%d")
            if len(weekly) >= 2:
                prev = weekly[-2]
                entry["weekly_close_prev"] = _round_close(ticker, prev["close"])
            series = []
            for bar in weekly:
                if _bar_is_open(bar, "week", now):
                    continue
                dt = datetime.utcfromtimestamp(bar["t"])
                series.append({
                    "as_of": dt.strftime("%Y-%m-%d"),
                    "close": _round_close(ticker, bar["close"]),
                })
            if ticker == "WTI" and series:
                entry["weekly_series"] = series[-8:]
    except Exception as e:
        print(f"  [WARN] Yahoo weekly {ticker}: {e}")

    try:
        monthly = _yahoo_history(yahoo_sym, "1mo", "2y")
        if monthly:
            chosen = pick_completed_bar(monthly, "month", now=now)
            if chosen:
                entry["monthly_close"] = _round_close(ticker, chosen["close"])
                entry["monthly_close_as_of"] = datetime.utcfromtimestamp(
                    chosen["t"]
                ).strftime("%Y-%m")
            if ticker == "BTC":
                cur = now.strftime("%Y-%m")
                by_period = {}
                for bar in monthly:
                    period = datetime.utcfromtimestamp(bar["t"]).strftime("%Y-%m")
                    if period == cur:
                        continue
                    by_period[period] = _round_close(ticker, bar["close"])
                periods = sorted(by_period)[-18:]
                entry["monthly_series"] = [
                    {"period": p, "close": by_period[p]} for p in periods
                ]
            if entry.get("week52_high") is not None:
                entry["ath_proxy"] = entry["week52_high"]
                entry["ath_note"] = "52-week high used as cycle-high proxy"
    except Exception as e:
        print(f"  [WARN] Yahoo monthly {ticker}: {e}")

    return entry


def fetch_yahoo_assets():
    """Fetch Yahoo chart data for all tracked symbols (one call each)."""
    results = {}
    for ticker, yahoo_sym in YAHOO_SYMBOLS.items():
        try:
            results[ticker] = fetch_yahoo_chart(ticker, yahoo_sym)
        except Exception as e:
            print(f"  [WARN] Yahoo {ticker}: {e}")
            results[ticker] = {
                "price": None,
                "change_pct": None,
                "week52_low": None,
                "week52_high": None,
            }
        time.sleep(0.3)
    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Fetching prices...")

    prices = {}
    fx = {}

    print("  CoinGecko: BTC")
    try:
        prices.update(fetch_coingecko())
    except Exception as e:
        print(f"  [ERROR] CoinGecko: {e}")

    print("  Yahoo Finance: XAUUSD, WTI, VIX (+ BTC 52W)")
    yahoo = fetch_yahoo_assets()

    # BTC: keep CoinGecko quote; attach Yahoo 52W if available
    if "BTC" in yahoo:
        y = yahoo["BTC"]
        if "BTC" in prices:
            if y.get("week52_low") is not None:
                prices["BTC"]["week52_low"] = y["week52_low"]
            if y.get("week52_high") is not None:
                prices["BTC"]["week52_high"] = y["week52_high"]
        else:
            # CoinGecko failed — fall back to Yahoo quote if present
            entry = {
                "price": y.get("price"),
                "change_pct": y.get("change_pct"),
                "week52_low": y.get("week52_low"),
                "week52_high": y.get("week52_high"),
            }
            if entry["price"] is None:
                print("  [WARN] BTC: no price from CoinGecko or Yahoo")
            prices["BTC"] = entry

    # XAUUSD / WTI: Yahoo primary, Stooq fallback for quote
    for ticker in ("XAUUSD", "WTI"):
        y = yahoo.get(ticker, {})
        entry = {
            "price": y.get("price"),
            "change_pct": y.get("change_pct"),
            "week52_low": y.get("week52_low"),
            "week52_high": y.get("week52_high"),
        }
        if entry["price"] is None:
            stooq_sym = STOOQ_QUOTE_FALLBACK.get(ticker)
            if stooq_sym:
                try:
                    sq = fetch_stooq(stooq_sym)
                    entry["price"] = sq["price"]
                    entry["change_pct"] = sq["change_pct"]
                    print(f"  [INFO] {ticker}: using Stooq fallback")
                except Exception as e:
                    print(f"  [WARN] Stooq fallback {ticker}: {e}")
        if entry["price"] is None:
            print(f"  [WARN] {ticker}: no price available — writing price: null")
        prices[ticker] = entry

    # VIX: Yahoo only
    if "VIX" in yahoo:
        y = yahoo["VIX"]
        entry = {
            "price": y.get("price"),
            "change_pct": y.get("change_pct"),
            "week52_low": y.get("week52_low"),
            "week52_high": y.get("week52_high"),
        }
        if entry["price"] is None:
            print("  [WARN] VIX: no price available — writing price: null")
        prices["VIX"] = entry

    print("  Stooq: USDJPY")
    try:
        usdjpy = fetch_stooq("usdjpy")
        fx["USDJPY"] = usdjpy["price"]
    except Exception as e:
        print(f"  [WARN] Stooq USDJPY: {e}")

    # Final guard: never leave a bare ranges dict without an explicit price key
    for ticker, entry in list(prices.items()):
        if "price" not in entry:
            print(f"  [WARN] {ticker}: missing price key after merge — setting price: null")
            entry["price"] = None
            entry.setdefault("change_pct", None)

    # Weekly / monthly closes (BTC, gold, WTI) — last *completed* bars
    print("  Yahoo history: weekly/monthly closes")
    for ticker in ("BTC", "XAUUSD", "WTI"):
        ysym = YAHOO_SYMBOLS.get(ticker)
        if ysym and ticker in prices:
            try:
                prices[ticker] = enrich_closes(ticker, ysym, prices[ticker])
                time.sleep(0.3)
            except Exception as e:
                print(f"  [WARN] enrich_closes {ticker}: {e}")

    core = ("BTC", "XAUUSD", "WTI", "VIX")
    if not prices or all((prices.get(t) or {}).get("price") is None for t in core):
        print(
            "[ERROR] all core prices are null — refusing to write prices.json",
            file=sys.stderr,
        )
        sys.exit(1)

    results = {
        "updated_at": now_utc(),
        "prices": prices,
        "fx": fx,
    }

    write_json(OUTPUT_FILE, results)
    print(f"Written to {OUTPUT_FILE}")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
