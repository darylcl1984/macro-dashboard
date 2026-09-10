"""Rebuild complete, same-month five-bloc history; keep China observations reviewed.

--source-dir can replay downloaded official files without network access.
Normal refresh uses only public central-bank endpoints plus FRED_API_KEY.
"""
import argparse
import csv
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fetch_dashboard_history import get

ROOT = Path(__file__).resolve().parents[1]
FX_CODES = {'EURUSD': 'EXUSEU', 'GBPUSD': 'EXUSUK', 'USDCNY': 'EXCHUS', 'USDJPY': 'EXJPUS'}


def build_rows(history, us, uk, ez, jp, fx):
    """Do not carry stocks across months or interpolate an absent observation."""
    cn = {r['period']: r['components_local']['CN_cny_tn'] for r in history
          if r.get('components_local', {}).get('CN_cny_tn') is not None
          and (not r.get('component_dates', {}).get('CN') or r['component_dates']['CN'][:7] == r['period'])}
    common = set(cn) & set(us) & set(uk) & set(ez) & set(jp)
    for values in fx.values():
        common &= set(values)
    rebuilt = {r['period']: r for r in history}
    for month in sorted(common):
        rates = {name: values[month] for name, values in fx.items()}
        if not all(v > 0 for v in rates.values()):
            raise ValueError('Invalid exchange rate')
        c = {'US_usd_bn': us[month], 'CN_cny_tn': cn[month], 'EZ_eur_tn': ez[month],
             'JP_jpy_tn': jp[month], 'UK_gbp_bn': uk[month]}
        total4 = c['US_usd_bn']/1000 + c['CN_cny_tn']/rates['USDCNY'] + c['EZ_eur_tn']*rates['EURUSD'] + c['JP_jpy_tn']/rates['USDJPY']
        rebuilt[month] = {'period': month, 'scope': '5bloc', 'component_dates': {k: month for k in ['US','CN','EZ','JP','UK']},
            'components_local': c, 'fx': rates, 'composite_usd': round(total4+c['UK_gbp_bn']/1000*rates['GBPUSD'], 6),
            'composite_usd_4bloc_ex_uk': round(total4, 6), 'flags': ['same_month_stocks', 'fx_monthly_avg_FRED'],
            'sources': {'US': 'FRED M2SL', 'UK': 'BoE LPMAUYN', 'EZ': 'ECB BSI.M.U2.Y.V.M20.X.1.U2.2300.Z01.E',
                        'JP': 'BOJ MD02.MAM1NAM2M2MO', 'CN': rebuilt.get(month, {}).get('sources', {}).get('CN', 'PBoC · reviewed monthly stock'),
                        'FX': 'FRED EXUSEU / EXUSUK / EXCHUS / EXJPUS'},
            'checked_at': datetime.now(timezone.utc).date().isoformat()}
    return [rebuilt[k] for k in sorted(rebuilt)], len(common)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path)
    parser.add_argument('--env-file', type=Path)
    args = parser.parse_args()
    if args.env_file and not os.environ.get('FRED_API_KEY'):
        for line in args.env_file.read_text(encoding='utf8').splitlines():
            if line.startswith('FRED_API_KEY='):
                os.environ['FRED_API_KEY'] = line.split('=', 1)[1].strip().strip('\"\x27')
    path = ROOT/'data/m2_history.json'
    history = json.loads(path.read_text(encoding='utf8'))
    start = min(r['period'] for r in history)
    def read(name, url):
        return (args.source_dir/name).read_text(encoding='utf8') if args.source_dir else get(url).text
    year = datetime.now().year
    uk_url = f'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&SeriesCodes=LPMAUYN&UsingCodes=Y&CSVF=TN&Datefrom=01/Jan/{start[:4]}&Dateto=31/Dec/{year}'
    ez_url = f'https://data-api.ecb.europa.eu/service/data/BSI/M.U2.Y.V.M20.X.1.U2.2300.Z01.E?startPeriod={start}&format=csvdata'
    jp_url = f'https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=MD02&code=MAM1NAM2M2MO&startDate={start.replace("-", "")}'
    with ThreadPoolExecutor(3) as pool:
        contents = list(pool.map(lambda item: read(*item), [('uk-m4.txt',uk_url), ('ecb-m2.txt',ez_url), ('boj-m2.txt',jp_url)]))
    uk = {datetime.strptime(r['DATE'].strip(), '%d %b %Y').strftime('%Y-%m'): float(r['LPMAUYN'])/1000 for r in csv.DictReader(io.StringIO(contents[0])) if r.get('LPMAUYN')}
    ez = {r['TIME_PERIOD']: float(r['OBS_VALUE'])/1e6 for r in csv.DictReader(io.StringIO(contents[1])) if r.get('OBS_VALUE')}
    vals = json.loads(contents[2])['RESULTSET'][0]['VALUES']
    jp = {str(d)[:4]+'-'+str(d)[4:6]: float(v)/10000 for d,v in zip(vals['SURVEY_DATES'], vals['VALUES']) if v is not None}
    us = {p['date'][:7]: p['value'] for p in json.loads((ROOT/'data/dashboard_history.json').read_text(encoding='utf8'))['series']['us_m2']['points']}
    def fx_read(item):
        name, code = item
        if args.source_dir:
            rows = json.loads((args.source_dir/(code+'.json')).read_text(encoding='utf8'))
        else:
            rows = get('https://api.stlouisfed.org/fred/series/observations', {'series_id': code, 'api_key': os.environ['FRED_API_KEY'], 'file_type': 'json', 'observation_start': start+'-01'}) .json()['observations']
        return name, {r['date'][:7]: float(r['value']) for r in rows if r['value'] != '.'}
    with ThreadPoolExecutor(4) as pool:
        fx = dict(pool.map(fx_read, FX_CODES.items()))
    rows, count = build_rows(history, us, uk, ez, jp, fx)
    if not count:
        raise ValueError('No complete months; existing file retained')
    temp = path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(rows, indent=2, ensure_ascii=False, allow_nan=False)+'\n', encoding='utf8')
    temp.replace(path)
    print(f'Rebuilt {count} complete same-month observations')


if __name__ == '__main__':
    main()
