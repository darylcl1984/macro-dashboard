"""
utils.py
Shared helpers for fetch_prices.py and fetch_macro.py.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import requests

# Repo-relative data directory
DATA_DIR = Path(__file__).parent.parent / "data"

# Single shared HTTP session
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "macro-dashboard/1.0"})


def fetch_json(url, params=None, headers=None, timeout=15):
    """GET a URL and return parsed JSON. Raises on non-2xx."""
    resp = SESSION.get(url, params=params, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def fetch_text(url, params=None, timeout=15):
    """GET a URL and return raw response text. Raises on non-2xx."""
    resp = SESSION.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.text


def now_utc():
    """Current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def write_json(path, data):
    """Write data as indented JSON to path, creating parent dirs as needed."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
