"""Validate the actual publishable snapshots, including cross-source calibration."""
import json
import math
import unittest
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / 'data'


def read(name):
    def invalid(value):
        raise ValueError(f'Non-finite JSON number: {value}')
    return json.loads((DATA / f'{name}.json').read_text(encoding='utf-8'), parse_constant=invalid)


class DashboardSnapshotTests(unittest.TestCase):
    def check_points(self, points, date_key='date', value_key='value', unique=True):
        self.assertTrue(points)
        dates = [date.fromisoformat(p[date_key]) for p in points]
        self.assertEqual(dates, sorted(dates))
        if unique:
            self.assertEqual(len(dates), len(set(dates)))
        for point in points:
            self.assertIsInstance(point[value_key], (int, float))
            self.assertTrue(math.isfinite(point[value_key]))

    def test_active_market_and_macro_histories_are_usable(self):
        history = read('dashboard_history')['series']
        for name in ('us_m2', 'debt_gdp', 'us_2y', 'us_30y', 'gold', 'bitcoin', 'stablecoins', 'fear_greed'):
            with self.subTest(series=name):
                self.check_points(history[name]['points'])
                self.assertGreater(len(history[name]['points']), 1)
        self.assertTrue(read('macro')['indicators'])
        self.assertTrue(read('manual'))
        self.assertTrue(read('gold_buying'))
        self.assertTrue(read('m2_history'))

    def test_etf_archive_and_canonical_weeks_form_one_series(self):
        self.check_points(read('etf_flows')['weekly'], 'week_ending', 'net_flow_musd')

    def test_benchmarks_have_usable_scores_and_attribution(self):
        benches = read('work_benchmarks')['benchmarks']
        self.assertEqual({b['id'] for b in benches}, {'apex', 'terminal'})
        for benchmark in benches:
            self.assertTrue(benchmark['source_url'].startswith('https://'))
            self.assertTrue(benchmark['license'])
            self.assertTrue(benchmark['rows'])
            for row in benchmark['rows']:
                self.assertTrue(0 <= row['score'] <= 100)

    def test_metr_calibration_matches_the_published_eci_snapshot(self):
        eci = read('technology')['eci']
        self.check_points(eci, unique=False)
        lookup = {(p['label'], p['date']): p['value'] for p in eci}
        context = read('metr_context')
        self.assertGreaterEqual(len(context['points']), 3)
        self.assertIn(context['anchor_id'], [p['id'] for p in context['points']])
        self.assertGreater(context['points_per_doubling'], 0)
        for point in context['points']:
            self.assertEqual(lookup.get((point['label'], point['date'])), point['eci'])
            self.assertTrue(0 < point['low_minutes'] <= point['minutes'] <= point['high_minutes'])


if __name__ == '__main__':
    unittest.main()
