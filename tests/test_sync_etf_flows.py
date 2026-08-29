"""Mapper: Liq weekly series → desk snapshot. No Farside typing in manual.json."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from sync_etf_flows import desk_snapshot, period_label  # noqa: E402


class TestEtfMapper(unittest.TestCase):
    def test_period_same_month(self):
        self.assertEqual(period_label("2026-08-21"), "2026-08-17/21")
        self.assertEqual(period_label("2026-08-28"), "2026-08-24/28")

    def test_desk_latest_and_prior(self):
        raw = {
            "weekly": [
                {"week_ending": "2026-08-14", "net_flow_musd": -385.2},
                {"week_ending": "2026-08-21", "net_flow_musd": 1917.8},
                {"week_ending": "2026-08-28", "net_flow_musd": 924.5},
            ]
        }
        desk = desk_snapshot(raw, synced_on="2026-08-29")
        self.assertEqual(desk["period"], "2026-08-24/28")
        self.assertEqual(desk["net_usd_m"], 924.5)
        self.assertEqual(desk["net_usd_bn"], 0.924)
        self.assertEqual(desk["prior_week_usd_m"], 1917.8)
        self.assertEqual(desk["streak_weeks_outflow"], 0)

    def test_outflow_streak(self):
        raw = {
            "weekly": [
                {"week_ending": "2026-06-12", "net_flow_musd": -10.0},
                {"week_ending": "2026-06-19", "net_flow_musd": -20.0},
                {"week_ending": "2026-06-26", "net_flow_musd": -30.0},
            ]
        }
        desk = desk_snapshot(raw, synced_on="2026-06-26")
        self.assertEqual(desk["streak_weeks_outflow"], 3)
        self.assertEqual(desk["prior_week_usd_m"], -20.0)


if __name__ == "__main__":
    unittest.main()
