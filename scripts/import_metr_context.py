"""Import selected public METR TH1.1 facts and match exact Epoch releases.

The fixed five-point rule is an illustration, not a regression or METR result.
This deliberately parses only the small, documented portion of METR's YAML
needed here; unexpected structure fails before replacing the previous file.
"""
import argparse
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://metr.org/assets/benchmark_results_1_1.yaml'
MATCHES = {
    'gpt_4': 'GPT-4 (Mar 2023)',
    'gpt_4_turbo_inspect': 'GPT-4 Turbo (Apr 2024)',
    'gpt_4o_inspect': 'GPT-4o (May 2024)',
    'claude_3_5_sonnet_20240620_inspect': 'Claude 3.5 Sonnet',
    'claude_3_5_sonnet_20241022_inspect': 'Claude 3.5 Sonnet (October 2024)',
    'claude_3_7_sonnet_inspect': 'Claude 3.7 Sonnet',
    'claude_4_opus_inspect': 'Claude Opus 4',
    'claude_4_1_opus_inspect': 'Claude Opus 4.1',
    'o3_inspect': 'o3',
    'gpt_5_2025_08_07_inspect': 'GPT-5',
    'claude_opus_4_5_inspect': 'Claude Opus 4.5',
    'gemini_3_pro': 'Gemini 3 Pro',
    'gpt_5_2': 'GPT-5.2',
    'claude_opus_4_6_inspect': 'Claude Opus 4.6',
    'gpt_5_3_codex': 'GPT-5.3 Codex',
    'gemini_3_1_pro': 'Gemini 3.1 Pro',
    'gpt_5_4': 'GPT-5.4',
}


def extract(text, eci):
    if not text.startswith('benchmark_name: METR-Horizon-v1.1\n'):
        raise ValueError('Unexpected METR benchmark version')
    blocks = dict(re.findall(r'^  (\w+):\n(.*?)(?=^  \w+:|\Z)', text, re.M | re.S))
    points = []
    for key, label in MATCHES.items():
        block = blocks[key]
        release = re.search(r'^    release_date: (\d{4}-\d{2}-\d{2})$', block, re.M)[1]
        metric = re.search(r'      p50_horizon_length:\n        ci_high: (\S+)\n        ci_low: (\S+)\n        estimate: (\S+)', block)
        high, low, minutes = map(float, metric.groups())
        if not all(math.isfinite(v) for v in (low, minutes, high)) or not 0 < low <= minutes <= high:
            raise ValueError('Invalid METR horizon interval')
        match = [p for p in eci if p['label'] == label and p['date'] == release]
        if len(match) != 1:
            raise ValueError(f'No unique Epoch model/release match: {label}')
        scaffolds = re.findall(r'^    - (.+)$', block, re.M)
        if not scaffolds:
            raise ValueError(f'Missing scaffold: {key}')
        points.append({'id': key, 'label': label, 'date': release, 'eci': match[0]['value'],
                       'minutes': minutes, 'low_minutes': low, 'high_minutes': high,
                       'scaffolds': scaffolds})
    return sorted(points, key=lambda p: p['date'])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, help='Saved public METR YAML; otherwise download')
    args = parser.parse_args()
    content = args.source.read_bytes() if args.source else urlopen(URL, timeout=45).read()
    technology = json.loads((ROOT / 'data/technology.json').read_text(encoding='utf-8'))
    points = extract(content.decode('utf-8'), technology['eci'])
    anchor = next(p for p in points if p['id'] == 'claude_3_7_sonnet_inspect')
    for p in points:
        estimate = anchor['minutes'] * 2 ** ((p['eci'] - anchor['eci']) / 5)
        p['illustrative_minutes'] = round(estimate, 6)
        p['measured_to_illustrative_ratio'] = round(p['minutes'] / estimate, 6)
    data = {
        'source': 'METR · Time Horizon 1.1', 'source_url': 'https://metr.org/time-horizons/',
        'data_url': URL, 'fetched_at': datetime.now(timezone.utc).isoformat(),
        'source_sha256': hashlib.sha256(content).hexdigest(),
        'benchmark': 'METR-Horizon-v1.1',
        'task_version': re.search(r'^long_tasks_version: (\S+)', content.decode(), re.M)[1],
        'eci_snapshot': technology['fetched_at'],
        'success_rate': 0.5, 'interval': '95% bootstrap confidence interval',
        'anchor_id': anchor['id'], 'points_per_doubling': 5,
        'calibration_source': 'https://epoch.ai/data/eci-documentation/faq',
        'axis_eci_range': [min(p['eci'] for p in points), max(p['eci'] for p in points)],
        'reliable_limit_minutes': 960,
        'interpretation': 'Model and release-date matches, not identical evaluation scaffolds. The right axis is an anchored historical illustration. METR values are separately published task-horizon estimates, not AI runtime or whole-job equivalence.',
        'points': points,
    }
    target = ROOT / 'data/metr_context.json'
    temporary = target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(target)
    ratios = [p['measured_to_illustrative_ratio'] for p in points]
    print(f'{len(points)} release matches; measured/illustrative ratio range {min(ratios):.2f}–{max(ratios):.2f}')


if __name__ == '__main__':
    main()
