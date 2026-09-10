"""Import original-publisher work results, never Artificial Analysis derivatives."""
import argparse
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from fetch_dashboard_history import get

ROOT = Path(__file__).resolve().parents[1]
APEX_URL = 'https://www.mercor.com/apex/apex-agents-leaderboard/'
TERMINAL_URL = 'https://www.tbench.ai/'


def require_frontier(rows):
    names = ' '.join(r['model'].lower() for r in rows)
    if 'fable 5.1' not in names or 'gpt-6 astra' not in names:
        raise ValueError('Required frontier coverage missing; previous snapshot retained')
    if not all(isinstance(r['score'], (int,float)) and math.isfinite(r['score']) and 0 <= r['score'] <= 100 for r in rows):
        raise ValueError('Invalid score')


def parse_apex(html):
    schemas = [json.loads(s) for s in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S)]
    if not any(s.get('@type') == 'Dataset' and s.get('url') == APEX_URL and s.get('license') == 'https://creativecommons.org/licenses/by/4.0/' for s in schemas):
        raise ValueError('APEX leaderboard licence declaration missing')
    # September 2026 revision has 240 tasks; do not silently reuse this version label.
    if '240 tasks' not in html:
        raise ValueError('APEX task/version changed; review before publishing')
    marker = '"leaderboardData":'
    raw = json.JSONDecoder().raw_decode(html[html.index(marker)+len(marker):])[0]
    rows = []
    for r in raw:
        for agent, score in r['score']['pass-1'].items():
            if score is None:
                continue
            rows.append({'model': r['model_name'], 'creator': r['providerName'], 'score': score,
                'reported_error': r.get('error', {}).get('pass-1', {}).get(agent),
                'agent': agent, 'effort': r.get('effort', 'unspecified'), 'release_date': r.get('release_date'),
                'evaluation_date': None})
    require_frontier(rows)
    return {'id': 'apex', 'title': 'APEX-Agents', 'version': '1.1', 'metric': 'Pass@1',
        'description': 'Professional work across banking, consulting and corporate law.',
        'source': 'Mercor · APEX-Agents', 'source_url': APEX_URL, 'license': 'CC BY 4.0',
        'license_url': 'https://creativecommons.org/licenses/by/4.0/',
        'version_source': 'https://www.mercor.com/blog/introducing-apex-agents-1-1/',
        'note': 'Single-attempt task success. Errors are as reported by Mercor. Evaluation dates are not supplied; model release dates are not evaluation dates.',
        'rows': rows}


def parse_terminal(html):
    data = None
    for chunk in re.findall(r'self\.__next_f\.push\((\[.*?\])\)</script>', html):
        payload = json.loads(chunk)
        if len(payload) < 2 or not isinstance(payload[1], str) or '"leaderboard"' not in payload[1]:
            continue
        txt = payload[1]
        if '{"state"' not in txt:
            continue
        state = json.JSONDecoder().raw_decode(txt[txt.index('{"state"'):])[0]['state']
        for query in state.get('queries', []):
            candidate = query.get('state', {}).get('data', {})
            if isinstance(candidate, dict) and candidate.get('leaderboard', {}).get('title') == 'Terminal-Bench 4.0':
                data = candidate
    if not data:
        raise ValueError('Terminal-Bench 4.0 results missing; version/parser review needed')
    rows = []
    for r in data['rows']:
        if r.get('status') != 'display':
            continue
        m, score = r['metadata'], r['metrics']
        rows.append({'model': m['model_display']['label'], 'creator': m['model_org']['label'],
            'agent': m['agent_display']['label'], 'effort': m['reasoning_effort'], 'score': score['accuracy'],
            'reported_error': score.get('accuracy_ci95_half_width'), 'evaluation_date': m['date'],
            'trials': score.get('n_trials')})
    require_frontier(rows)
    return {'id': 'terminal', 'title': 'Terminal-Bench', 'version': '4.0', 'metric': 'Resolution rate',
        'description': 'Technical tasks completed in a working terminal environment.',
        'source': 'Terminal-Bench · Stanford / Harbor / Laude Institute', 'source_url': TERMINAL_URL,
        'license': 'Apache 2.0', 'license_url': '../docs/licenses/terminal-bench-Apache-2.0.txt',
        'license_evidence': 'https://epoch.ai/benchmarks/use-this-data',
        'note': 'Model plus agent setup. Reported errors are 95% confidence-interval half-widths; close scores can overlap.',
        'rows': rows}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path)
    args = parser.parse_args()
    def read(name, url):
        return (args.source_dir/name).read_text(encoding='utf8') if args.source_dir else get(url).text
    benches = [parse_apex(read('apex-page.txt', APEX_URL)), parse_terminal(read('terminal-page.txt', TERMINAL_URL))]
    payload = {'fetched_at': datetime.now(timezone.utc).isoformat(), 'benchmarks': benches,
        'selection': 'Top three distinct model labs by benchmark score; requested frontier models outside that selection are shown separately without changing the ranking.',
        'omitted': [{'name': 'OSWorld 2.0', 'checked_at': '2026-09-10', 'source_url': 'https://osworld-v2.xlang.ai/',
                     'reason': 'Official published results do not include Fable 5.1 or GPT-6 Astra.'}]}
    path = ROOT/'data/work_benchmarks.json'
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False)+'\n', encoding='utf8')
    temporary.replace(path)
    print('Imported original-publisher APEX and Terminal-Bench results with frontier coverage')


if __name__ == '__main__':
    main()
