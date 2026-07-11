"""
utils.py
Shared helpers for fetch_prices.py and fetch_macro.py.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import requests

# Repo-relative data directory
DATA_DIR = Path(__file__).parent.parent / "data"

# Single shared HTTP session
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "macro-dashboard/1.0"})

_YAHOO_UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}


def fetch_json(url, params=None, headers=None, timeout=15):
    """GET a URL and return parsed JSON. Raises on non-2xx."""
    resp = SESSION.get(url, params=params, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def fetch_text(url, params=None, headers=None, timeout=15):
    """GET a URL and return raw response text. Raises on non-2xx."""
    resp = SESSION.get(url, params=params, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp.text


def now_utc():
    """Current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def write_json(path, data):
    """Write data as indented JSON to path, creating parent dirs as needed."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ---------------------------------------------------------------------------
# Stooq quote helper (shared by prices + macro FX)
# ---------------------------------------------------------------------------

def fetch_stooq(symbol):
    """
    Fetch a Stooq last-quote. Returns {price, change_pct}.
    change_pct is always None from this endpoint.
    """
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


# ---------------------------------------------------------------------------
# Yahoo chart-meta quote (FX fallback)
# ---------------------------------------------------------------------------

def fetch_yahoo_quote(yahoo_sym):
    """
    Fetch regularMarketPrice from Yahoo chart meta.
    yahoo_sym examples: EURUSD=X, GBPUSD=X, CNY=X, JPY=X, GC%3DF
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
    if price is None:
        raise ValueError(f"No regularMarketPrice for {yahoo_sym}")
    return float(price)
