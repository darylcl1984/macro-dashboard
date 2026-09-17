import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from report_refresh import report


class RefreshReportTests(unittest.TestCase):
    def test_missing_credential_names_cause_despite_success_conclusion(self):
        steps = {
            'upstream_access': {'outcome': 'failure', 'conclusion': 'success',
                                'outputs': {'sensitive': 'must-not-be-printed'}},
            'upstream': {'outcome': 'skipped'},
            'validation': {'outcome': 'success'},
            'publication': {'outcome': 'success'},
        }
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            summary = Path(directory) / 'summary.md'
            summary.write_text('Existing summary\n', encoding='utf-8')
            with redirect_stdout(output):
                self.assertEqual(report(steps, summary), 1)
            text = summary.read_text(encoding='utf-8')
            self.assertTrue(text.startswith('Existing summary\n'))
            self.assertIn('LIQUIDITY_MONITOR_READ_SSH_KEY', text)
            self.assertNotIn('must-not-be-printed', text)
        self.assertIn('Configure private ETF source access', output.getvalue())
        self.assertNotIn('must-not-be-printed', output.getvalue())

    def test_success_and_scheduled_skips_do_not_fail(self):
        with redirect_stdout(io.StringIO()) as output:
            self.assertEqual(report({'markets': {'outcome': 'success'},
                                     'epoch': {'outcome': 'skipped'}}), 0)
        self.assertEqual(output.getvalue(), '')

    def test_source_validation_and_publication_failures_remain_visible(self):
        with redirect_stdout(io.StringIO()) as output:
            self.assertEqual(report({key: {'outcome': 'failure'}
                                     for key in ['markets', 'validation', 'publication']}), 1)
        for label in ['Refresh prices', 'Validate snapshots', 'Publish validated updates']:
            self.assertIn(label, output.getvalue())


if __name__ == '__main__':
    unittest.main()
