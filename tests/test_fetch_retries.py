import io
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import fetch_dashboard_history as history


class FetchRetryTests(unittest.TestCase):
    def test_gateway_timeout_recovers_without_logging_query_credentials(self):
        success = MagicMock()
        success.__enter__.return_value.read.return_value = b'{"ok":true}'
        error = HTTPError('https://example.org/', 504, 'Gateway timeout', {}, None)
        with patch.object(history, 'urlopen', side_effect=[error, success]) as request, \
                patch.object(history.time, 'sleep') as sleep, redirect_stdout(io.StringIO()) as output:
            result = history.get('https://example.org/data', {'api_key': 'private-test-value'})
        self.assertEqual(result.json(), {'ok': True})
        self.assertEqual(request.call_count, 2)
        sleep.assert_called_once_with(1)
        self.assertIn('HTTP 504', output.getvalue())
        self.assertNotIn('private-test-value', output.getvalue())
        self.assertNotIn('api_key', output.getvalue())

    def test_retries_are_bounded_and_permanent_failure_propagates(self):
        with patch.object(history, 'urlopen', side_effect=URLError('unavailable')) as request, \
                patch.object(history.time, 'sleep') as sleep, redirect_stdout(io.StringIO()):
            with self.assertRaises(URLError):
                history.get('https://example.org/')
        self.assertEqual(request.call_count, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1, 2])

    def test_authentication_and_certificate_failures_are_not_retried(self):
        errors = [HTTPError('https://example.org/', 401, 'Unauthorized', {}, None),
                  URLError(history.ssl.SSLCertVerificationError('invalid certificate'))]
        for error in errors:
            with self.subTest(error=type(error).__name__), \
                    patch.object(history, 'urlopen', side_effect=error) as request, \
                    patch.object(history.time, 'sleep') as sleep:
                with self.assertRaises(type(error)):
                    history.get('https://example.org/')
                self.assertEqual(request.call_count, 1)
                sleep.assert_not_called()


if __name__ == '__main__':
    unittest.main()
