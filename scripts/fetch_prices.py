"""
fetch_prices.py
Fetches latest price data and writes to data/prices.json.

Sources:
  - CoinGecko (no key): BTC
  - Stooq (no key):     WTI (CL.F), XAUUSD, ^VIX
  - Finnhub (API key):  Equities (NVDA, TSLA, PLTR, TSM, GOOGL, META, NOW, GEV, MSTR, GLD)
                        FX rates (CNYUSD, EURUSD, JPYUSD, GBPUSD, USDAUD)
"""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")
DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT_FILE = DATA_DIR / "prices.json"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "macro-dashboard/1.0"})


def fetch_json(url, params=None, timeout=15):
    resp = SESSION.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# CoinGecko
# ---------------------------------------------------------------------------

def fetch_coingecko():
    data = fetch_json(
        "https://api.coingecko.com/api/v3/simple/price",
        params={"ids": "bitcoin", "vs_currencies": "usd"},
    )
    return {"BTC": data["bitcoin"]["usd"]}


# ---------------------------------------------------------------------------
# Stooq  (returns CSV-like JSON via pandas_datareader convention, but the
#         simple quote endpoint returns JSON directly)
# ---------------------------------------------------------------------------

def fetch_stooq(symbol):
    """Fetch latest close from Stooq's JSON endpoint."""
    url = f"https://stooq.com/q/l/?s={symbol.lower()}&f=sd2t2ohlcv&h&e=json"
    data = fetch_json(url)
    # Response: {"symbols": [{"symbol": ..., "close": ...}]}
    symbols = data.get("symbols", [])
    if not symbols:
        raise ValueError(f"No data for {symbol} from Stooq")
    close = symbols[0].get("close")
    if close is None or close == "N/D":
        raise ValueError(f"Missing close price for {symbol} from Stooq")
    return float(close)


def fetch_stooq_prices():
    results = {}
    symbols = {
        "WTI": "cl.f",   # WTI Crude front-month futures
        "XAUUSD": "xauusd",
    }
    for label, sym in symbols.items():
        try:
            results[label] = fetch_stooq(sym)
        except Exception as e:
            print(f"  [WARN] Stooq {label}: {e}")
    return results


# ---------------------------------------------------------------------------
# Finnhub
# ---------------------------------------------------------------------------

FINNHUB_BASE = "https://finnhub.io/api/v1"
FINNHUB_RATE_LIMIT_DELAY = 0.25  # seconds between calls (free tier: 60 req/min)


def finnhub_get(path, params):
    params["token"] = FINNHUB_API_KEY
    data = fetch_json(f"{FINNHUB_BASE}{path}", params=params)
    time.sleep(FINNHUB_RATE_LIMIT_DELAY)
    return data


def fetch_finnhub_quote(symbol):
    """Returns current price via /quote endpoint."""
    data = finnhub_get("/quote", {"symbol": symbol})
    price = data.get("c")  # 'c' = current price
    if not price:
        raise ValueError(f"No price returned for {symbol}")
    return float(price)


def fetch_finnhub_forex(from_cur, to_cur):
    """Returns mid-rate via /forex/rates."""
    data = finnhub_get("/forex/rates", {"base": from_cur})
    rates = data.get("quote", {})
    rate = rates.get(to_cur)
    if rate is None:
        raise ValueError(f"No rate for {from_cur}/{to_cur}")
    return float(rate)


def fetch_finnhub_prices():
    if not FINNHUB_API_KEY:
        print("  [WARN] FINNHUB_API_KEY not set — skipping Finnhub data")
        return {}, {}

    equities = ["NVDA", "TSLA", "PLTR", "TSM", "GOOGL", "META", "NOW", "GEV", "MSTR", "GLD"]
    equity_prices = {}
    for sym in equities:
        try:
            equity_prices[sym] = fetch_finnhub_quote(sym)
        except Exception as e:
            print(f"  [WARN] Finnhub equity {sym}: {e}")

    # FX: all expressed as X per 1 USD
    # Finnhub /forex/rates with base=USD gives USD→other rates.
    # We want CNYUSD, EURUSD, JPYUSD, GBPUSD (foreign per USD inverse), USDAUD
    fx_prices = {}
    try:
        usd_rates = finnhub_get("/forex/rates", {"base": "USD"})["quote"]
        time.sleep(FINNHUB_RATE_LIMIT_DELAY)

        fx_map = {
            "USDCNY": usd_rates.get("CNY"),  # CNY per 1 USD
            "USDEUR": usd_rates.get("EUR"),  # EUR per 1 USD
            "USDJPY": usd_rates.get("JPY"),  # JPY per 1 USD
            "USDGBP": usd_rates.get("GBP"),  # GBP per 1 USD
            "USDAUD": usd_rates.get("AUD"),  # AUD per 1 USD
        }
        # Convert to "foreign currency per 1 USD" for display consistency
        fx_prices["CNYUSD"] = round(1 / float(usd_rates["CNY"]), 6) if usd_rates.get("CNY") else None
        fx_prices["EURUSD"] = round(1 / float(usd_rates["EUR"]), 6) if usd_rates.get("EUR") else None
        fx_prices["JPYUSD"] = round(1 / float(usd_rates["JPY"]), 6) if usd_rates.get("JPY") else None
        fx_prices["GBPUSD"] = round(1 / float(usd_rates["GBP"]), 6) if usd_rates.get("GBP") else None
        fx_prices["USDAUD"] = round(float(usd_rates["AUD"]), 6) if usd_rates.get("AUD") else None
    except Exception as e:
        print(f"  [WARN] Finnhub FX rates: {e}")

    return equity_prices, fx_prices


# ---------------------------------------------------------------------------
# VIX via Finnhub
# ---------------------------------------------------------------------------

def fetch_vix():
    if not FINNHUB_API_KEY:
        return {}
    try:
        price = fetch_finnhub_quote("^VIX")
        return {"VIX": price}
    except Exception as e:
        print(f"  [WARN] VIX: {e}")
        return {}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Fetching prices...")

    results = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "prices": {},
    }
    prices = results["prices"]

    # BTC
    print("  CoinGecko: BTC")
    try:
        prices.update(fetch_coingecko())
    except Exception as e:
        print(f"  [ERROR] CoinGecko: {e}")

    # WTI + Gold
    print("  Stooq: WTI, XAUUSD")
    try:
        prices.update(fetch_stooq_prices())
    except Exception as e:
        print(f"  [ERROR] Stooq: {e}")

    # Equities + FX
    print("  Finnhub: equities + FX")
    equity_prices, fx_prices = fetch_finnhub_prices()
    prices.update(equity_prices)
    prices.update(fx_prices)

    # VIX
    print("  Finnhub: VIX")
    prices.update(fetch_vix())

    # Write output
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(results, indent=2))
    print(f"Written to {OUTPUT_FILE}")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
