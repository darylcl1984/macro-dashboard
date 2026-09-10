import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from backfill_global_money import build_rows
from import_work_benchmarks import parse_apex, require_frontier
from fetch_macro import apply_history_upsert


class BackfillTests(unittest.TestCase):
    def test_daily_fx_cannot_replace_completed_monthly_average_basket(self):
        row = {'period':'2026-07', 'scope':'5bloc', 'component_dates':{k:'2026-07' for k in ['US','CN','EZ','JP','UK']},
               'flags':['fx_monthly_avg_FRED'], 'composite_usd':100}
        daily = dict(row, flags=[], composite_usd=110)
        rows, used = apply_history_upsert([row], daily)
        self.assertEqual(rows, [row])
        self.assertEqual(used['composite_usd'], 100)

    def test_missing_component_is_not_carried_forward(self):
        history = [{'period': m, 'components_local': {'CN_cny_tn': 7}} for m in ['2025-01','2025-02']]
        values = {'2025-01': 1, '2025-02': 2}
        fx = {name: values for name in ['USDCNY','USDJPY','GBPUSD','EURUSD']}
        rows, count = build_rows(history, values, {'2025-01': 1}, values, values, fx)
        self.assertEqual(count, 1)
        self.assertNotIn('UK_gbp_bn', rows[1]['components_local'])
        history[0]['component_dates'] = {'CN': '2025-02'}
        self.assertEqual(build_rows(history, values, {'2025-01': 1}, values, values, fx)[1], 0)

    def test_frontier_coverage_and_finite_score_are_required(self):
        with self.assertRaises(ValueError):
            require_frontier([{'model': 'old model', 'score': 90}])
        with self.assertRaises(ValueError):
            require_frontier([{'model':'Fable 5.1','score':50}, {'model':'GPT-6 Astra','score':float('nan')}])

    def test_apex_rejects_missing_licence_and_version_change(self):
        with self.assertRaises(ValueError):
            parse_apex('<html>240 tasks</html>')
        schema = {'@type':'Dataset', 'url':'https://www.mercor.com/apex/apex-agents-leaderboard/', 'license':'https://creativecommons.org/licenses/by/4.0/'}
        with self.assertRaises(ValueError):
            parse_apex('<script type="application/ld+json">'+json.dumps(schema)+'</script>480 tasks')


if __name__ == '__main__':
    unittest.main()
