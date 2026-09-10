"""Backfill the three-section desk. Public sources; preserve last good series on failure."""
import argparse
import csv
import io
import json
import math
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'dashboard_history.json'
TODAY = date.today()


class Response:
    def __init__(self, content):
        self.content = content
        self.text = content.decode('utf-8-sig')

    def json(self):
        return json.loads(self.text)


def get(url, params=None):
    if params:
        url += '?' + urlencode(params)
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; MacroDashboard/2.0)'})
    with urlopen(request, timeout=45) as response:
        return Response(response.read())


def series(points, source, url, unit, **extra):
    clean = {}
    for point in points:
        value = point.get('value')
        if isinstance(value, (int, float)) and math.isfinite(value):
            clean[point['date']] = dict(point, value=round(value, 6))
    if not clean:
        raise ValueError('No valid observations')
    return {'source': source, 'source_url': url, 'unit': unit,
            'fetched_at': datetime.now(timezone.utc).isoformat(),
            'points': [clean[k] for k in sorted(clean)], **extra}


def fred(code, unit):
    start_date = f'{TODAY.year - (31 if code == "M2SL" else 11)}-01-01'
    key = os.environ.get('FRED_API_KEY')
    env_file = ROOT / '.env'
    if not key and env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            if line.startswith('FRED_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('\"\x27')
    if key:
        observations = get('https://api.stlouisfed.org/fred/series/observations', params={
            'series_id': code, 'api_key': key, 'file_type': 'json', 'observation_start': start_date
        }).json()['observations']
        return series([{'date': r['date'], 'value': float(r['value'])} for r in observations if r['value'] != '.'],
                      f'FRED · {code}', f'https://fred.stlouisfed.org/series/{code}', unit)
    url = 'https://fred.stlouisfed.org/graph/fredgraph.csv'
    try:
        content = get(url, params={'id': code, 'cosd': start_date}).text
    except Exception:
        mirror_url = f'https://api.db.nomics.world/v22/series/FRED/{code}'
        doc = get(mirror_url, params={'observations': 1}).json()['series']['docs'][0]
        points = [{'date': d[:10], 'value': float(v)} for d, v in zip(doc['period_start_day'], doc['value']) if v != 'NA']
        return series(points, f'FRED · {code} via DBnomics', f'https://fred.stlouisfed.org/series/{code}', unit,
                      mirror_url=mirror_url, provider_updated_at=doc.get('indexed_at'))
    rows = csv.DictReader(io.StringIO(content))
    points = []
    for row in rows:
        try:
            points.append({'date': row.get('observation_date', row.get('DATE')), 'value': float(row[code])})
        except (ValueError, KeyError):
            continue
    return series(points, f'FRED · {code}', f'https://fred.stlouisfed.org/series/{code}', unit)


def gold():
    url = 'https://stooq.com/q/d/l/'
    try:
        content = get(url, params={'s': 'xauusd', 'i': 'd', 'd1': f'{TODAY.year-4}{TODAY:%m%d}', 'd2': f'{TODAY:%Y%m%d}'}).text
        points = [{'date': r['Date'], 'value': float(r['Close'])} for r in csv.DictReader(io.StringIO(content))]
        return series(points, 'Stooq · XAU/USD spot', 'https://stooq.com/q/?s=xauusd', 'USD / troy oz', instrument='XAUUSD spot')
    except (KeyError, ValueError, OSError):
        # One consistent instrument for the whole series, explicitly labeled.
        rows = get('https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF', params={'interval': '1d', 'range': '5y'}).json()['chart']['result'][0]
        points = [{'date': datetime.fromtimestamp(t, timezone.utc).date().isoformat(), 'value': v}
                  for t, v in zip(rows['timestamp'], rows['indicators']['quote'][0]['close'])
                  if v is not None and datetime.fromtimestamp(t, timezone.utc).date() < TODAY]
        return series(points, 'Yahoo Finance · GC=F', 'https://finance.yahoo.com/quote/GC=F/', 'USD / troy oz',
                      instrument='Gold futures · GC=F', note='Unadjusted continuous futures proxy; contract rolls can affect the series. Spot export unavailable.')


def bitcoin():
    url = 'https://api.exchange.coinbase.com/products/BTC-USD/candles'
    start = datetime(TODAY.year - 4, TODAY.month, TODAY.day, tzinfo=timezone.utc)
    end = datetime.combine(TODAY, datetime.min.time(), tzinfo=timezone.utc)
    points = []
    while start < end:
        stop = min(start + timedelta(days=299), end)
        rows = get(url, params={'granularity': 86400, 'start': start.isoformat(), 'end': stop.isoformat()}).json()
        points.extend({'date': datetime.fromtimestamp(r[0], timezone.utc).date().isoformat(), 'value': r[4]} for r in rows if r[0] < end.timestamp())
        start = stop
    return series(points, 'Coinbase · BTC-USD', 'https://www.coinbase.com/price/bitcoin', 'USD / BTC', instrument='Coinbase BTC-USD spot')


def stablecoins():
    url = 'https://stablecoins.llama.fi/stablecoincharts/all'
    rows = get(url).json()
    points = []
    for row in rows:
        # Keep only USD pegs. Other peg buckets are not additional USD supply.
        value = row.get('totalCirculating', {}).get('peggedUSD')
        if value is None:
            value = row.get('totalCirculatingUSD', {}).get('peggedUSD')
        if value is not None:
            points.append({'date': datetime.fromtimestamp(int(row['date']), timezone.utc).date().isoformat(), 'value': value / 1e9})
    return series(points, 'DefiLlama · USD-pegged stablecoins', 'https://defillama.com/stablecoins', 'USD billions')


def fear_greed():
    rows = get('https://api.alternative.me/fng/', params={'limit': 0}).json()['data']
    return series([{'date': datetime.fromtimestamp(int(r['timestamp']), timezone.utc).date().isoformat(), 'value': int(r['value'])} for r in rows],
                  'Alternative.me', 'https://alternative.me/crypto/fear-and-greed-index/', 'Index / 100')


JOBS = {'us_m2': lambda: fred('M2SL', 'USD billions'),
        'debt_gdp': lambda: fred('GFDEGDQ188S', '% of GDP'),
        'us_2y': lambda: fred('DGS2', 'Yield %'), 'us_30y': lambda: fred('DGS30', 'Yield %'),
        'gold': gold, 'bitcoin': bitcoin, 'stablecoins': stablecoins, 'fear_greed': fear_greed}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='+', choices=list(JOBS), default=list(JOBS))
    parser.add_argument('--env-file', type=Path, help='Optional local env file; reads only FRED_API_KEY')
    parser.add_argument('--strict', action='store_true', help='Save successful updates, then fail the run if any source failed')
    args = parser.parse_args()
    if args.env_file and args.env_file.exists() and not os.environ.get('FRED_API_KEY'):
        for line in args.env_file.read_text(encoding='utf-8').splitlines():
            if line.startswith('FRED_API_KEY='):
                os.environ['FRED_API_KEY'] = line.split('=', 1)[1].strip().strip('\"\x27')
    payload = json.loads(OUTPUT.read_text(encoding='utf-8')) if OUTPUT.exists() else {'schema_version': 1, 'series': {}}
    failures = dict(payload.get('fetch_failures', {}))
    failed_this_run = False
    with ThreadPoolExecutor(max_workers=4) as pool:
        pending = {pool.submit(JOBS[name]): name for name in args.only}
        for future in as_completed(pending):
            name = pending[future]
            try:
                value = future.result()
                print(f"{name}: {len(value['points'])} observations, {value['points'][0]['date']} to {value['points'][-1]['date']}", flush=True)
                payload['series'][name] = value
                failures.pop(name, None)
            except Exception as exc:
                failed_this_run = True
                failures[name] = type(exc).__name__
                print(f'{name}: fetch failed ({type(exc).__name__}); retained existing data', flush=True)
    payload['last_attempt'] = datetime.now(timezone.utc).isoformat()
    payload['fetch_failures'] = failures
    OUTPUT.parent.mkdir(exist_ok=True)
    temporary = OUTPUT.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(payload, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(OUTPUT)
    if args.strict and failed_this_run:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
