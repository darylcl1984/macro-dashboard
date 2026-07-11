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
import time

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
