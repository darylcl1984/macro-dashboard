"""
fetch_macro.py
Fetches macro indicators and writes to data/macro.json.

Sources:
  - FRED (API key):    US M2 (M2SL), US 10Y Treasury (DGS10), US Dollar Index (DTWEXBGS)
  - BOJ REST API:      Japan M2 (MD02/MAM1NAM2M2MO, 100M JPY monthly avg → trillions)
  - Alternative.me:    Crypto Fear & Greed Index (no key)

Manual data (quarterly updates by hand in data/manual.json):
  - CN M2, UK M2, Global M2 composite
"""

import json
import os
from datetime import datetime, timedelta, timezone

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
        "US_M2":    "M2SL",      # billions USD, monthly
        "US_10Y":   "DGS10",     # percent, daily
        "USD_INDEX":"DTWEXBGS",  # index, daily
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
# BOJ — Japan M2
# API: https://www.stat-search.boj.or.jp/api/v1/getDataCode
# DB: MD02, Series: MAM1NAM2M2MO (M2, monthly average, 100 million JPY)
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
    dates  = vals.get("SURVEY_DATES", [])
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
