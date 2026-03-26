"""
fetch_prices.py
Fetches latest price data and writes to data/prices.json.

Output schema:
  prices.<SYMBOL> = { "price": float, "change_pct": float | null }

Sources:
  - CoinGecko (no key): BTC (includes 24h change)
  - Stooq (no key):     WTI (CL.F), XAUUSD
  - Finnhub (API key):  Equities (NVDA, TSLA, PLTR, TSM, GOOGL, META, NOW, GEV, MSTR)
  - Yahoo Finance:      VIX
"""

import json
import os
import re
import time

from utils import DATA_DIR, SESSION, fetch_json, now_utc, write_json

FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")
OUTPUT_FILE = DATA_DIR / "prices.json"

FINNHUB_BASE = "https://finnhub.io/api/v1"
FINNHUB_RATE_LIMIT_DELAY = 0.25  # seconds (free tier: 60 req/min)


def finnhub_get(path, params):
    params["token"] = FINNHUB_API_KEY
    data = fetch_json(f"{FINNHUB_BASE}{path}", params=params)
    time.sleep(FINNHUB_RATE_LIMIT_DELAY)
    return data


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
# Stooq — WTI, XAUUSD (no change_pct available from this endpoint)
# ---------------------------------------------------------------------------

def fetch_stooq(symbol):
    url = f"https://stooq.com/q/l/?s={symbol.lower()}&f=sd2t2ohlcv&h&e=json"
    resp = SESSION.get(url, timeout=10)
    resp.raise_for_status()
    # Stooq sometimes emits malformed JSON (e.g. "volume":} with no value) — patch before parsing
    text = re.sub(r'"volume":\s*([,}])', r'"volume": null\1', resp.text)
    data = json.loads(text)
    symbols = data.get("symbols", [])
    if not symbols:
        raise ValueError(f"No data for {symbol} from Stooq")
    row = symbols[0]
    # Futures (e.g. CL.F) may return N/D for close during off-hours; fall back to open
    price = row.get("close")
    if price is None or price == "N/D":
        price = row.get("open")
    if price is None or price == "N/D":
        raise ValueError(f"Missing price for {symbol} from Stooq")
    return {"price": float(price), "change_pct": None}


def fetch_stooq_prices():
    results = {}
    symbols = {
        "WTI":    "cl.f",
        "XAUUSD": "xauusd",
        "USDJPY": "usdjpy",
    }
    for label, sym in symbols.items():
        try:
            results[label] = fetch_stooq(sym)
        except Exception as e:
            print(f"  [WARN] Stooq {label}: {e}")
    return results


# ---------------------------------------------------------------------------
# Finnhub — equities + VIX (with change_pct from previous close)
# ---------------------------------------------------------------------------

def fetch_finnhub_quote(symbol):
    """Returns {price, change_pct} using Finnhub /quote (c=current, pc=prev close)."""
    data = finnhub_get("/quote", {"symbol": symbol})
    c = data.get("c")
    pc = data.get("pc")
    if not c:
        raise ValueError(f"No price returned for {symbol}")
    change_pct = round((c - pc) / pc * 100, 2) if pc else None
    return {"price": float(c), "change_pct": change_pct}


def fetch_finnhub_prices():
    if not FINNHUB_API_KEY:
        print("  [WARN] FINNHUB_API_KEY not set — skipping Finnhub data")
        return {}, {}

    equity_prices = {}
    equities = ["NVDA", "TSLA", "PLTR", "TSM", "GOOGL", "META", "NOW", "GEV", "MSTR"]
    for sym in equities:
        try:
            equity_prices[sym] = fetch_finnhub_quote(sym)
        except Exception as e:
            print(f"  [WARN] Finnhub equity {sym}: {e}")

    return equity_prices, {}


def fetch_vix():
    try:
        resp = SESSION.get(
            "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX",
            headers={"User-Agent": "Mozilla/5.0"},
            params={"interval": "1d", "range": "1d"},
            timeout=10,
        )
        resp.raise_for_status()
        meta = resp.json()["chart"]["result"][0]["meta"]
        price = meta["regularMarketPrice"]
        prev  = meta["chartPreviousClose"]
        return {"VIX": {"price": price, "change_pct": round((price - prev) / prev * 100, 2)}}
    except Exception as e:
        print(f"  [WARN] VIX: {e}")
        return {}


# ---------------------------------------------------------------------------
# Yahoo Finance — 52-week high/low for all tracked assets
# ---------------------------------------------------------------------------

YAHOO_52W_SYMBOLS = {
    "BTC":    "BTC-USD",
    "XAUUSD": "GC%3DF",    # GC=F URL-encoded
    "WTI":    "CL%3DF",    # CL=F URL-encoded
    "NVDA":   "NVDA",
    "TSLA":   "TSLA",
    "GOOGL":  "GOOGL",
    "META":   "META",
    "TSM":    "TSM",
    "PLTR":   "PLTR",
    "MSTR":   "MSTR",
    "NOW":    "NOW",
    "GEV":    "GEV",
    "VIX":    "%5EVIX",
}

_YAHOO_UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}


def fetch_yahoo_52w(ticker, yahoo_sym):
    try:
        resp = SESSION.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}",
            params={"interval": "1d", "range": "1y"},
            headers=_YAHOO_UA,
            timeout=15,
        )
        resp.raise_for_status()
        meta = resp.json()["chart"]["result"][0]["meta"]
        return {
            "week52_low":  meta["fiftyTwoWeekLow"],
            "week52_high": meta["fiftyTwoWeekHigh"],
        }
    except Exception as e:
        print(f"    [WARN] Yahoo 52W {ticker}: {e}")
        return {"week52_low": None, "week52_high": None}


def fetch_all_52w():
    results = {}
    for ticker, yahoo_sym in YAHOO_52W_SYMBOLS.items():
        results[ticker] = fetch_yahoo_52w(ticker, yahoo_sym)
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

    print("  Stooq: WTI, XAUUSD, USDJPY")
    stooq = fetch_stooq_prices()
    # Separate FX rates from asset prices
    for key in ("USDJPY",):
        if key in stooq:
            fx[key] = stooq.pop(key)["price"]
    prices.update(stooq)

    print("  Finnhub: equities + FX")
    equity_prices, fx_rates = fetch_finnhub_prices()
    prices.update(equity_prices)
    fx.update(fx_rates)

    print("  Yahoo Finance: VIX")
    prices.update(fetch_vix())

    print("  Yahoo Finance: 52-week ranges")
    week52 = fetch_all_52w()
    for ticker, w52 in week52.items():
        if ticker in prices:
            prices[ticker].update(w52)
        else:
            prices[ticker] = w52

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
