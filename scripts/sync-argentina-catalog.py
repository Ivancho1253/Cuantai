"""Import local share identities and a dated liquidity order from BYMA's public reports.

No prices are imported and no model or investment recommendation selects the companies.
"""
import argparse
import html
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

DIRECTORY = 'https://www.byma.com.ar/financiarse/para-emisoras/empresas-listadas'
DASHBOARD = 'https://www.iamc.com.ar/informesanuales/'
REPORT = 'https://www.iamc.com.ar/d/acc.json'
TARGET = Path(__file__).resolve().parents[1] / 'src/lib/market/data/argentina.json'


def load(url, file=None):
    if file:
        return Path(file).read_text(encoding='utf-8')
    request = Request(url, headers={'User-Agent': 'Cuantai catalog importer', 'Accept': 'text/html,application/json'})
    with urlopen(request, timeout=30) as response:
        return response.read().decode('utf-8')


def clean(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', value))).strip()


def build_catalog(directory, dashboard, report):
    payload = re.search(r'<script\s+id="payload"\s+type="application/json">([\s\S]*?)</script>', dashboard)
    if not payload:
        raise ValueError('BYMA dashboard no longer publishes its reference JSON')
    data = json.loads(payload.group(1))
    stocks = [item for item in data['cat'] if item['t'] == 'Accion' and item['mn'] == 'ARS']
    by_isin = {item['i']: item for item in stocks if item.get('i')}
    activity = report['acc']
    # The deferred JSON supplies rows; date/panel metadata stays in the dashboard payload.
    if activity.get('fecha', data['acc']['fecha']) != data['acc']['fecha']:
        raise ValueError('Reference catalog and liquidity report have different observation dates')
    ranked = sorted(activity['rows'], key=lambda row: (-row['adtv'], row['tk']))
    if not ranked or any(not math.isfinite(row['adtv']) or row['adtv'] < 0 for row in ranked):
        raise ValueError('Invalid liquidity observations')
    liquidity = {row['tk']: (index + 1, row) for index, row in enumerate(ranked)}
    entries, excluded, aliases = {}, [], []
    for match in re.finditer(r'<a\b[^>]*class="[^"]*card-v1_header[^"]*"[^>]*>([\s\S]*?)</a>', directory):
        body = match.group(1)
        ticker = re.search(r'<p[^>]*>(.*?)</p>', body, re.S)
        name = re.search(r'<h3[^>]*>(.*?)</h3>', body, re.S)
        if not ticker or not name:
            raise ValueError('Incomplete listed company')
        symbol, name = clean(ticker.group(1)).upper(), clean(name.group(1))
        if not re.fullmatch(r'[A-Z0-9]{2,8}', symbol):
            raise ValueError(f'Invalid symbol: {symbol}')
        if 'interrumpida' in name.lower():
            excluded.append({'symbol': symbol, 'reason': 'Trading interrupted according to the BYMA directory'})
            continue
        detail = directory[match.end():match.end() + 3500]
        isin = re.search(r'\bAR[A-Z0-9]{9}[0-9]\b', clean(detail))
        sector = re.search(r'>Sector</div>\s*<div[^>]*>(.*?)</div>', detail, re.S)
        if not isin or not sector:
            raise ValueError(f'Missing identity or sector for {symbol}')
        identity = by_isin.get(isin.group(0))
        if identity and identity['tk'] != symbol:
            aliases.append({'directorySymbol': symbol, 'symbol': identity['tk'], 'isin': isin.group(0)})
            symbol = identity['tk']
        entry = {'symbol': symbol, 'name': name, 'sector': clean(sector.group(1)), 'isin': isin.group(0)}
        if identity and identity.get('x'):
            entry['index'] = identity['x']
        if symbol in liquidity:
            rank, row = liquidity[symbol]
            entry.update({'liquidityRank': rank, 'adtv40ARS': str(row['adtv'])})
        if symbol in entries:
            raise ValueError(f'Duplicate local listing: {symbol}')
        entries[symbol] = entry
    # A local listing with a published close must not silently disappear from the directory join.
    if set(liquidity) - set(entries):
        raise ValueError(f'Unresolved report listings: {sorted(set(liquidity) - set(entries))}')
    if len(entries) < 60 or len(entries) > 150:
        raise ValueError('Unexpected size of the local equity universe')
    return {
        'retrievedAt': datetime.now(timezone.utc).isoformat(), 'asOf': data['acc']['fecha'],
        'source': DIRECTORY, 'referenceSource': DASHBOARD, 'liquiditySource': REPORT,
        'requestedCount': 100, 'rankedCount': len(liquidity),
        'methodology': 'Local ARS share listings from BYMA, excluding explicitly interrupted listings. Descending average daily traded value over 40 trading sessions (ADTV), as published in the dated BYMA daily equity report. Listings without ADTV follow alphabetically. This is a liquidity order, not a forecast or a ranking of investment quality. No ADRs, CEDEARs or duplicate ISIN identities are added to reach 100.',
        'aliases': aliases, 'excluded': excluded,
        'entries': sorted(entries.values(), key=lambda item: (item.get('liquidityRank', 100000), item['symbol'])),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory-file')
    parser.add_argument('--dashboard-file')
    parser.add_argument('--report-file')
    args = parser.parse_args()
    catalog = build_catalog(load(DIRECTORY, args.directory_file), load(DASHBOARD, args.dashboard_file), json.loads(load(REPORT, args.report_file)))
    temporary = TARGET.with_suffix('.tmp')
    temporary.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(TARGET)
    print(f'Imported {len(catalog["entries"])} local shares; {catalog["rankedCount"]} ranked by ADTV, as of {catalog["asOf"]}.')


if __name__ == '__main__':
    main()
