"""Completed week/month bars — never the in-progress Yahoo print."""

from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from fetch_prices import pick_completed_bar  # noqa: E402


def _ts(y, m, d):
    return int(datetime(y, m, d, tzinfo=timezone.utc).timestamp())


class TestPickCompletedBar(unittest.TestCase):
    def test_month_skips_open_bar(self):
        bars = [
            {"t": _ts(2026, 7, 1), "close": 4047.0},
            {"t": _ts(2026, 8, 1), "close": 4500.0},
            {"t": _ts(2026, 9, 1), "close": 4477.0},
        ]
        now = datetime(2026, 9, 5, 12, 0, 0)
        chosen = pick_completed_bar(bars, "month", now=now)
        self.assertEqual(chosen["close"], 4500.0)

    def test_month_keeps_closed_bar(self):
        bars = [
            {"t": _ts(2026, 7, 1), "close": 4047.0},
            {"t": _ts(2026, 8, 1), "close": 4500.0},
        ]
        now = datetime(2026, 9, 5, 12, 0, 0)
        chosen = pick_completed_bar(bars, "month", now=now)
        self.assertEqual(chosen["close"], 4500.0)

    def test_week_skips_open_bar_on_wednesday(self):
        # Last bar is Mon 31 Aug 2026 (ISO week 36); Wednesday 2 Sep is the same week.
        bars = [
            {"t": _ts(2026, 8, 24), "close": 100.0},
            {"t": _ts(2026, 8, 31), "close": 110.0},
        ]
        now = datetime(2026, 9, 2, 15, 0, 0)  # Wednesday
        chosen = pick_completed_bar(bars, "week", now=now)
        self.assertEqual(chosen["close"], 100.0)

    def test_week_accepts_friday_bar_on_saturday(self):
        bars = [
            {"t": _ts(2026, 8, 28), "close": 100.0},
            {"t": _ts(2026, 9, 4), "close": 91.22},
        ]
        now = datetime(2026, 9, 5, 12, 0, 0)  # Saturday
        chosen = pick_completed_bar(bars, "week", now=now)
        self.assertEqual(chosen["close"], 91.22)


if __name__ == "__main__":
    unittest.main()
