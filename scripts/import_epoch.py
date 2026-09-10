"""Import attributed Epoch ECI data from its public CSV archive."""
import csv
import io
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile
import argparse

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://epoch.ai/data/benchmark_data.zip'


def validate_points(points):
    """Reject malformed exports before replacing the last usable snapshot."""
    for point in points:
        datetime.strptime(point['date'], '%Y-%m-%d')
        for key in ('value', 'low', 'high', 'stderr'):
            if key in point and not math.isfinite(point[key]):
                raise ValueError(f'Non-finite Epoch {key}')
        if 'low' in point and not point['low'] <= point['value'] <= point['high']:
            raise ValueError('Invalid Epoch confidence bounds')


def parse_archive(content):
    archive = ZipFile(io.BytesIO(content))
    def rows(name):
        return csv.DictReader(io.StringIO(archive.read(name).decode('utf-8-sig')))
    eci = []
    for r in rows('epoch_capabilities_index/eci_scores.csv'):
        if not r['date'] or not r['eci']:
            continue
        p = {'date': r['date'][:10], 'value': float(r['eci']), 'label': r['Display name'] or r['Model'], 'lab': r['Organization']}
        if r['eci_ci_low'] and r['eci_ci_high']:
            p.update(low=float(r['eci_ci_low']), high=float(r['eci_ci_high']))
        eci.append(p)
    if not eci:
        raise ValueError('Required Epoch data missing; previous file retained')
    validate_points(eci)
    return {'source': 'Epoch AI, AI Benchmarking Hub', 'source_url': 'https://epoch.ai/benchmarks/use-this-data',
            'license': 'CC BY 4.0', 'fetched_at': datetime.now(timezone.utc).isoformat(),
            'eci': sorted(eci, key=lambda p: p['date'])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path)
    args = parser.parse_args()
    if args.archive:
        content = args.archive.read_bytes()
    else:
        with urlopen(Request(URL, headers={'User-Agent': 'Mozilla/5.0'}), timeout=45) as response:
            content = response.read()
    data = parse_archive(content)
    path = ROOT / 'data' / 'technology.json'
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(path)
    print(f"Imported {len(data['eci'])} ECI results")


if __name__ == '__main__':
    main()
