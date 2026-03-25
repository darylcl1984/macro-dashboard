"""
fetch_prices.py
Fetches latest price data and writes to data/prices.json.

Output schema:
  prices.<SYMBOL> = { "price": float, "change_pct": float | null }
  fx.<PAIR>       = float  (raw rate)

Sources:
  - CoinGecko (no key): BTC (includes 24h change)
  - Stooq (no key):     WTI (CL.F), XAUUSD
  - Finnhub (API key):  Equities (NVDA, TSLA, PLTR, TSM, GOOGL, META, NOW, GEV, MSTR)
                        GLD ETF: stored raw as GLD + derived spot as XAUUSD_GLD (÷0.092)
                        VIX
                        FX rates (CNYUSD, EURUSD, JPYUSD, GBPUSD, USDAUD)
  Derived:              GOLD_AUD = XAUUSD * USDAUD
"""

import json
import os
import time

from utils import DATA_DIR, fetch_json, now_utc, write_json

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
    data = fetch_json(url)
    symbols = data.get("symbols", [])
    if not symbols:
        raise ValueError(f"No data for {symbol} from Stooq")
    close = symbols[0].get("close")
    if close is None or close == "N/D":
        raise ValueError(f"Missing close price for {symbol} from Stooq")
    return {"price": float(close), "change_pct": None}


def fetch_stooq_prices():
    results = {}
    symbols = {
        "WTI": "cl.f",
        "XAUUSD": "xauusd",
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
    equities = ["NVDA", "TSLA", "PLTR", "TSM", "GOOGL", "META", "NOW", "GEV", "MSTR", "GLD"]
    for sym in equities:
        try:
            quote = fetch_finnhub_quote(sym)
            if sym == "GLD":
                # Store raw ETF price (for display) and derived spot price (for reference)
                equity_prices["GLD"] = quote
                equity_prices["XAUUSD_GLD"] = {
                    "price": round(quote["price"] / 0.092, 2),
                    "change_pct": quote["change_pct"],
                }
            else:
                equity_prices[sym] = quote
        except Exception as e:
            print(f"  [WARN] Finnhub equity {sym}: {e}")

    # FX: fetch once as base=USD, then invert where needed
    fx_rates = {}
    try:
        usd_rates = finnhub_get("/forex/rates", {"base": "USD"})["quote"]
        fx_rates["USDAUD"] = round(float(usd_rates["AUD"]), 6) if usd_rates.get("AUD") else None
        # Conventional display: foreign currency per 1 USD (inverted)
        fx_rates["CNYUSD"] = round(1 / float(usd_rates["CNY"]), 6) if usd_rates.get("CNY") else None
        fx_rates["EURUSD"] = round(1 / float(usd_rates["EUR"]), 6) if usd_rates.get("EUR") else None
        fx_rates["JPYUSD"] = round(1 / float(usd_rates["JPY"]), 6) if usd_rates.get("JPY") else None
        fx_rates["GBPUSD"] = round(1 / float(usd_rates["GBP"]), 6) if usd_rates.get("GBP") else None
    except Exception as e:
        print(f"  [WARN] Finnhub FX rates: {e}")

    return equity_prices, fx_rates


def fetch_vix():
    if not FINNHUB_API_KEY:
        return {}
    try:
        return {"VIX": fetch_finnhub_quote("^VIX")}
    except Exception as e:
        print(f"  [WARN] VIX: {e}")
        return {}


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

    print("  Stooq: WTI, XAUUSD")
    prices.update(fetch_stooq_prices())

    print("  Finnhub: equities + FX")
    equity_prices, fx_rates = fetch_finnhub_prices()
    prices.update(equity_prices)
    fx.update(fx_rates)

    print("  Finnhub: VIX")
    prices.update(fetch_vix())

    # Derived: gold in AUD
    xauusd = prices.get("XAUUSD", {}).get("price")
    usdaud = fx.get("USDAUD")
    if xauusd and usdaud:
        prices["GOLD_AUD"] = {"price": round(xauusd * usdaud, 2), "change_pct": None}

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
