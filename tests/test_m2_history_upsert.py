"""Protect complete 5-bloc history months from mixed-vintage overwrite."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from fetch_macro import apply_history_upsert, _is_complete_aligned  # noqa: E402


def _row(period, dates, flags=None, scope="5bloc"):
    return {
        "period": period,
        "scope": scope,
        "component_dates": dates,
        "components_local": {
            "US_usd_bn": 23000,
            "CN_cny_tn": 350,
            "EZ_eur_tn": 16.0,
            "JP_jpy_tn": 1290,
            "UK_gbp_bn": 3300,
        },
        "composite_usd": 108.0,
        "flags": flags or [],
    }


JULY_DATES = {
    "US": "2026-07-01",
    "CN": "2026-07",
    "EZ": "2026-07",
    "JP": "202607",
    "UK": "2026-07",
}

MIXED_JULY_KEYED = {
    "US": "2026-08-01",
    "CN": "2026-07",
    "EZ": "2026-07",
    "JP": "202607",
    "UK": "2026-07",
}


class TestCompleteAligned(unittest.TestCase):
    def test_july_complete(self):
        self.assertTrue(_is_complete_aligned(_row("2026-07", JULY_DATES)))

    def test_mixed_not_aligned(self):
        self.assertFalse(_is_complete_aligned(_row("2026-07", MIXED_JULY_KEYED)))


class TestHistoryUpsert(unittest.TestCase):
    def test_keeps_complete_july_when_incoming_mixed(self):
        complete = _row("2026-07", JULY_DATES)
        mixed = _row("2026-07", MIXED_JULY_KEYED, flags=["mixed_vintage", "vintage_min=2026-07"])
        mixed["composite_usd"] = 999.0
        history, yoy = apply_history_upsert([complete], mixed)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["composite_usd"], 108.0)
        self.assertEqual(yoy["composite_usd"], 108.0)

    def test_finalizes_mixed_with_complete(self):
        mixed = _row("2026-07", MIXED_JULY_KEYED, flags=["mixed_vintage"])
        complete = _row("2026-07", JULY_DATES)
        complete["composite_usd"] = 108.5
        history, yoy = apply_history_upsert([mixed], complete)
        self.assertEqual(history[0]["composite_usd"], 108.5)
        self.assertEqual(yoy["composite_usd"], 108.5)
        self.assertEqual(history[0].get("flags"), [])

    def test_appends_new_period(self):
        july = _row("2026-07", JULY_DATES)
        june_mixed = _row("2026-06", MIXED_JULY_KEYED, flags=["mixed_vintage"])
        history, _ = apply_history_upsert([july], june_mixed)
        periods = [e["period"] for e in history]
        self.assertEqual(periods, ["2026-06", "2026-07"])


if __name__ == "__main__":
    unittest.main()
