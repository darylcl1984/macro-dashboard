import json
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from utils import write_json
from import_epoch import validate_points, parse_archive
from fetch_dashboard_history import gold, Response
import fetch_dashboard_history as history


class DataIntegrityTests(unittest.TestCase):
    def test_epoch_import_needs_only_eci_and_rejects_empty_export(self):
        header = 'date,eci,Display name,Model,Organization,eci_ci_low,eci_ci_high\n'
        def archive(csv):
            output = io.BytesIO()
            with ZipFile(output, 'w') as target:
                target.writestr('epoch_capabilities_index/eci_scores.csv', csv)
            return output.getvalue()
        result = parse_archive(archive(header + '2026-09-01,160,Model A,a,Lab,159,161\n'))
        self.assertEqual(result['eci'][0]['value'], 160)
        self.assertNotIn('ebr', result)
        with self.assertRaises(ValueError):
            parse_archive(archive(header))

    def test_partial_refresh_retains_failed_series_and_reports_failure(self):
        old = {'points': [{'date': '2026-09-01', 'value': 1}]}
        new = {'points': [{'date': '2026-09-02', 'value': 2}]}
        def unavailable():
            raise OSError('source unavailable')
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'history.json'
            target.write_text(json.dumps({'series': {'gold': old, 'bitcoin': old},
                                          'fetch_failures': {'us_m2': 'TimeoutError', 'bitcoin': 'OSError'}}))
            with patch.object(history, 'OUTPUT', target), patch.object(history, 'JOBS', {'gold': unavailable, 'bitcoin': lambda: new}), patch('sys.argv', ['refresh', '--strict']):
                with self.assertRaises(SystemExit) as error:
                    history.main()
            self.assertEqual(error.exception.code, 1)
            result = json.loads(target.read_text())
            self.assertEqual(result['series'], {'gold': old, 'bitcoin': new})
            self.assertEqual(result['fetch_failures'], {'gold': 'OSError', 'us_m2': 'TimeoutError'})
            self.assertEqual(list(Path(directory).glob('*.tmp')), [])

    def test_invalid_json_cannot_destroy_last_good_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'data.json'
            write_json(path, {'value': 10})
            with self.assertRaises(ValueError):
                write_json(path, {'value': float('nan')})
            self.assertEqual(json.loads(path.read_text()), {'value': 10})
            write_json(path, {'value': 20})
            self.assertEqual(json.loads(path.read_text()), {'value': 20})
            self.assertEqual(list(Path(directory).glob('*.tmp')), [])

    def test_epoch_rejects_invalid_dates_and_nonfinite_scores(self):
        for point in [{'date': '2026-02-30', 'value': 100},
                      {'date': '2026-01-01', 'value': float('nan')},
                      {'date': '2026-01-01', 'value': 100, 'low': 101, 'high': 102}]:
            with self.assertRaises(ValueError):
                validate_points([point])

    def test_gold_uses_labeled_futures_fallback_on_network_failure(self):
        yahoo = {'chart': {'result': [{'timestamp': [1704067200], 'indicators': {'quote': [{'close': [2000]}]}}]}}
        with patch('fetch_dashboard_history.get', side_effect=[OSError('network unavailable'), Response(json.dumps(yahoo).encode())]):
            result = gold()
        self.assertEqual(result['instrument'], 'Gold futures · GC=F')
        self.assertEqual(result['points'][0]['value'], 2000)


if __name__ == '__main__':
    unittest.main()
