"""
Map liquidity-monitor data/etf_flows.json (canonical Farside weekly series)
onto this desk's data/etf_flows.json. Do not type Farside weeks by hand here.

Source (first hit):
  ETF_FLOWS_SRC env
  ../liquidity-monitor/data/etf_flows.json  (sibling checkout)
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from utils import DATA_DIR, now_utc, write_json

OUTPUT_FILE = DATA_DIR / "etf_flows.json"
DEFAULT_SRC = (
    Path(__file__).resolve().parent.parent.parent
    / "liquidity-monitor"
    / "data"
    / "etf_flows.json"
)


def resolve_src() -> Path | None:
    env = (os.environ.get("ETF_FLOWS_SRC") or "").strip()
    if env:
        p = Path(env)
        return p if p.is_file() else None
    if DEFAULT_SRC.is_file():
        return DEFAULT_SRC
    return None


def period_label(week_ending: str) -> str:
    """Friday week-ending → 'YYYY-MM-DD/DD' (or '/MM-DD' if the week crosses months)."""
    fri = date.fromisoformat(week_ending)
    mon = fri - timedelta(days=4)
    if mon.month == fri.month:
        return f"{mon.isoformat()[:7]}-{mon.day:02d}/{fri.day:02d}"
    return f"{mon.isoformat()[:7]}-{mon.day:02d}/{fri.month:02d}-{fri.day:02d}"


def outflow_streak(weekly: list[dict]) -> int:
    n = 0
    for j in range(len(weekly) - 1, -1, -1):
        row = weekly[j]
        if j < len(weekly) - 1:
            later = date.fromisoformat(weekly[j + 1]["week_ending"])
            earlier = date.fromisoformat(row["week_ending"])
            if (later - earlier).days > 7:
                break
        flow = row.get("net_flow_musd")
        if flow is not None and flow < 0:
            n += 1
        else:
            break
    return n


def desk_snapshot(raw: dict, synced_on: str | None = None) -> dict | None:
    weekly = sorted(raw.get("weekly") or [], key=lambda r: r["week_ending"])
    if not weekly:
        return None
    latest = weekly[-1]
    prior = weekly[-2] if len(weekly) >= 2 else None
    net_m = latest.get("net_flow_musd")
    if net_m is None:
        return None
    as_of = synced_on or date.today().isoformat()
    desk = {
        "period": period_label(latest["week_ending"]),
        "net_usd_m": net_m,
        "net_usd_bn": round(net_m / 1000.0, 3),
        "streak_weeks_outflow": outflow_streak(weekly),
        "updated": as_of,
        "source": "Farside Investors (via liquidity-monitor/data/etf_flows.json)",
    }
    if prior and prior.get("net_flow_musd") is not None:
        desk["prior_week_usd_m"] = prior["net_flow_musd"]
    return desk


def build_payload(raw: dict) -> dict:
    weekly = sorted(raw.get("weekly") or [], key=lambda r: r["week_ending"])
    synced_at = now_utc()
    desk = desk_snapshot(raw, synced_on=synced_at[:10])
    return {
        "source": "liquidity-monitor",
        "canonical_path": "liquidity-monitor/data/etf_flows.json",
        "source_url": raw.get("source_url", "https://farside.co.uk/btc/"),
        "synced_at": synced_at,
        "notes": (
            "Derived. Do not type Farside weeks here. "
            "Writer: liquidity-monitor/data/etf_flows.json. "
            "Run scripts/sync_etf_flows.py after appending a week on Liq."
        ),
        "weekly": weekly,
        "desk": desk,
    }


def sync_etf_flows(required: bool = True) -> dict | None:
    src = resolve_src()
    if src is None:
        msg = (
            "ETF canonical file not found "
            f"(ETF_FLOWS_SRC or {DEFAULT_SRC})"
        )
        if required:
            print(f"[ERROR] {msg}", file=sys.stderr)
            raise SystemExit(1)
        print(f"  [INFO] {msg} — keeping existing data/etf_flows.json")
        return None

    raw = json.loads(src.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or not raw.get("weekly"):
        msg = f"{src} has no weekly series"
        if required:
            print(f"[ERROR] {msg}", file=sys.stderr)
            raise SystemExit(1)
        print(f"  [WARN] {msg}")
        return None

    payload = build_payload(raw)
    write_json(OUTPUT_FILE, payload)
    desk = payload.get("desk") or {}
    print(
        f"    ETF desk: period={desk.get('period')} "
        f"net_usd_m={desk.get('net_usd_m')} from {src}"
    )
    return payload


def main():
    print("Syncing ETF flows from liquidity-monitor…")
    sync_etf_flows(required=True)
    print(f"Written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
