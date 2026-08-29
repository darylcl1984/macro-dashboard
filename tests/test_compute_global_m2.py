"""Three pipeline contracts for compute_global_m2 (TASK-02)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from fetch_macro import compute_global_m2  # noqa: E402


def _fx():
    return {
        "EURUSD": {"value": 1.2},
        "GBPUSD": {"value": 1.3},
        "USDCNY": {"value": 7.0},
        "USDJPY": {"value": 160.0},
    }


def _indicators(**overrides):
    base = {
        "US_M2": {"value": 23000, "date": "2026-05-01"},
        "JP_M2": {"value": 1600, "date": "202605"},
        "EZ_M2": {"value": 16.0, "date": "2026-05"},
        "UK_M4": {"value": 3000, "date": "2026-05"},
    }
    base.update(overrides)
    return base


def _manual(cn=350.0):
    return {"china_m2": {"value": cn, "period": "2026-05"}}


class TestComputeGlobalM2(unittest.TestCase):
    def test_happy_path_five_bloc_sum(self):
        global_m2, snapshot = compute_global_m2(_indicators(), _manual(), _fx())
        self.assertIsNotNone(global_m2)
        self.assertIsNotNone(snapshot)
        # US 23.00 + CN 50.00 + EZ 19.20 + JP 10.00 + UK 3.90
        self.assertEqual(
            global_m2["components"],
            {"US": 23.0, "CN": 50.0, "EZ": 19.2, "JP": 10.0, "UK": 3.9},
        )
        self.assertEqual(global_m2["value"], 106.1)
        self.assertGreaterEqual(global_m2["value"], 90)
        self.assertLessEqual(global_m2["value"], 125)
        self.assertEqual(snapshot["scope"], "5bloc")
        self.assertEqual(snapshot["composite_usd"], 106.1)

    def test_missing_component_skips_partial_sum(self):
        indicators = _indicators()
        del indicators["UK_M4"]
        global_m2, snapshot = compute_global_m2(indicators, _manual(), _fx())
        self.assertIsNone(global_m2)
        self.assertIsNone(snapshot)

    def test_total_outside_90_125_skips(self):
        # US $90T + other blocs → well above $125T
        global_m2, snapshot = compute_global_m2(
            _indicators(US_M2={"value": 90000, "date": "2026-05-01"}),
            _manual(),
            _fx(),
        )
        self.assertIsNone(global_m2)
        self.assertIsNone(snapshot)


if __name__ == "__main__":
    unittest.main()
