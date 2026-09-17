"""Name failed refresh steps, including failures masked by continue-on-error."""
import json
import os
from pathlib import Path


STEP_NAMES = {
    'dashboard_checkout': 'Check out dashboard',
    'setup_python': 'Set up Python',
    'setup_node': 'Set up Node',
    'dependencies': 'Install dependencies',
    'cadence': 'Select refresh cadence',
    'markets': 'Refresh prices, dollar rails and sentiment',
    'upstream_access': 'Configure private ETF source access',
    'upstream': 'Read canonical ETF source',
    'etf': 'Sync ETF weeks',
    'macro': 'Refresh regional macro indicators',
    'histories': 'Refresh US money, debt and Treasury histories',
    'global_money': 'Rebuild global money history',
    'epoch': 'Refresh Epoch ECI',
    'metr': 'Refresh METR measurements and calibration',
    'benchmarks': 'Refresh work benchmarks',
    'validation': 'Validate snapshots and calculations',
    'publication': 'Publish validated updates',
}


def report(steps, summary_path=None):
    failed = [step_id for step_id, state in steps.items()
              if state.get('outcome') == 'failure']
    if not failed:
        return 0
    # Use controlled labels; never print outputs, which can contain secrets.
    labels = [STEP_NAMES.get(step_id, 'Unidentified workflow step') for step_id in failed]
    message = 'Failed steps: ' + '; '.join(labels) + '.'
    if 'upstream_access' in failed:
        message += (' Add the LIQUIDITY_MONITOR_READ_SSH_KEY Actions secret '
                    '(read-only liquidity-monitor deploy key), or '
                    'LIQUIDITY_MONITOR_READ_TOKEN (Contents read-only).')
    elif 'upstream' in failed:
        message += ' Check the ETF credential, repository access and master branch.'
    print(f'::error title=Dashboard refresh failed::{message}')
    if summary_path:
        with Path(summary_path).open('a', encoding='utf-8') as summary:
            summary.write('## Dashboard refresh failed\n\n' + message + '\n')
    return 1


def main():
    return report(json.loads(os.environ['STEP_OUTCOMES']), os.environ.get('GITHUB_STEP_SUMMARY'))


if __name__ == '__main__':
    raise SystemExit(main())
