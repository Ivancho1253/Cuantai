"""Refresh discovery snapshots from SPY holdings, SEC listings and CoinGecko.

Requires pdfplumber for the public BYMA instrument list. No quotes are imported.
"""
import io
import json
import re
import html
import subprocess
from pathlib import Path
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
import zipfile
import pdfplumber

ROOT = Path(__file__).resolve().parents[1] / 'src/lib/market/data'
SPY = 'https://www.ssga.com/us/en/individual/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx'
SEC = 'https://www.sec.gov/files/company_tickers_exchange.json'
COINS = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false'
BYMA = 'https://www.byma.com.ar/productos/productos-financieros/cedears'
CAJA = 'https://cajadevalores.com.ar/pdf/CEDEARS.xlsx'


def download(url):
    # Use the project's Node fetch implementation consistently across platforms.
    result = subprocess.run(['node', '-e', '''
      (async () => {
        const url = process.argv[1];
        const headers = {'User-Agent': process.env.SEC_USER_AGENT || 'Cuantai/0.1 catalog-sync'};
        if (url.includes('coingecko.com') && process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
        const response = await fetch(url, {headers, signal: AbortSignal.timeout(60000)});
        if (!response.ok) throw new Error('Catalog source HTTP ' + response.status);
        process.stdout.write(Buffer.from(await response.arrayBuffer()));
      })().catch(error => { console.error(error.message); process.exitCode = 1; });
    ''', url], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return result.stdout


def spy_rows(data):
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        strings = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', ns)]
        root = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        rows = []
        for row in root.findall('.//m:sheetData/m:row', ns):
            cells = {}
            for cell in row.findall('m:c', ns):
                column = ''.join(char for char in cell.attrib['r'] if char.isalpha())
                value = cell.find('m:v', ns)
                inline = cell.find('m:is', ns)
                text = value.text if value is not None else ''.join(inline.itertext()) if inline is not None else ''
                cells[column] = strings[int(text)] if cell.get('t') == 's' and text else text
            rows.append(cells)
        return rows


def cedear_rows(data):
    entries = {}
    conflicts = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        text = pdf.pages[0].extract_text()
        date = re.search(r'Actualizado\s*(\d{2}/\d{2}/\d{4})', text)
        if not date:
            raise ValueError('Missing BYMA publication date')
        for page in pdf.pages:
            words = page.extract_words()
            # Anchor rows on the symbol column; wrapped issuer/market names stay in their row.
            anchors = [word for word in words if 270 <= word['x0'] < 323 and 115 < word['top'] < 740 and re.fullmatch(r'[A-Z0-9.]+', word['text'])]
            if len(anchors) != sum(bool(re.fullmatch(r'\d+:\d+', word['text'])) for word in words):
                raise ValueError(f'Unparsed CEDEAR rows on BYMA page {page.page_number}')
            for index, anchor in enumerate(anchors):
                top = (anchors[index - 1]['top'] + anchor['top']) / 2 if index else 114
                bottom = (anchor['top'] + anchors[index + 1]['top']) / 2 if index + 1 < len(anchors) else 740
                cells = [' '.join(word['text'] for word in words if left <= word['x0'] < right and top <= word['top'] < bottom) for left, right in [(50, 270), (323, 399), (399, 450)]]
                name, market, ratio = cells
                if not name or not re.fullmatch(r'\d+\s*:\s*\d+', ratio):
                    raise ValueError(f'Incomplete BYMA row: {anchor["text"]}')
                symbol = anchor['text']
                item = {'symbol': symbol, 'name': name, 'underlyingMarket': market, 'ratio': ratio, 'kind': 'etf' if re.search(r'\bETF\b', name, re.IGNORECASE) else 'stock', 'source': 'BYMA'}
                if symbol in entries:
                    conflicts.append({'symbol': symbol, 'rows': [entries[symbol], item]})
                entries[symbol] = item
        return entries, date.group(1), conflicts


def import_cedears():
    page = download(BYMA).decode('utf-8')
    link = re.search(r'https://cdn\.prod\.website-files\.com/[^"<>\s]*BYMA-CEDEARs\.pdf', page, re.IGNORECASE)
    if not link:
        raise ValueError('BYMA no longer links its public CEDEAR instrument list')
    source = html.unescape(link.group(0))
    entries, date, conflicts = cedear_rows(download(source))
    # Caja's issuer table verifies ETF identities and resolves the duplicate XLU row in BYMA's PDF.
    kind = 'stock'
    for row in spy_rows(download(CAJA)):
        if row.get('A') == 'CEDEAR de ETF':
            kind = 'etf'
        elif row.get('A') == 'CEDEAR de Acciones':
            kind = 'stock'
        symbol = row.get('B', '')
        if not re.fullmatch(r'[A-Z][A-Z0-9.]*', symbol) or not re.fullmatch(r'\d+:\d+', row.get('I', '')):
            continue
        entries[symbol] = {'symbol': symbol, 'name': row['A'], 'underlyingSymbol': row['C'], 'underlyingMarket': row['H'], 'ratio': row['I'], 'kind': kind, 'source': 'Caja de Valores'}
    if not 400 <= len(entries) <= 1500:
        raise ValueError(f'Unexpected CEDEAR program count: {len(entries)}')
    return {'source': source, 'sourcePage': BYMA, 'issuerSource': CAJA, 'asOf': date, 'conflicts': conflicts, 'entries': sorted(entries.values(), key=lambda item: item['symbol'])}


def main():
    rows = spy_rows(download(SPY))
    filings = json.loads(download(SEC))
    listings = {row[2].replace('-', '.'): row for row in filings['data']}
    stocks = []
    for row in rows[4:]:
        ticker = row.get('B', '')
        if row.get('H') != 'USD' or not ticker or not ticker.replace('.', '').isalpha() or not ticker.isupper():
            continue
        listing = listings.get(ticker)
        if not listing or listing[3] not in ['Nasdaq', 'NYSE', 'CBOE']:
            raise ValueError(f'Missing verified listing exchange: {ticker}')
        stocks.append([listing[3].upper(), ticker, listing[1]])
    coins = json.loads(download(COINS))
    if not 500 <= len(stocks) <= 510:
        raise ValueError(f'Unexpected S&P 500 equity count: {len(stocks)}')
    if len(coins) != 100 or any(not isinstance(coin.get('id'), str) or not coin['id'] or not all(isinstance(coin.get(k), str) and coin[k] for k in ['symbol', 'name']) or not isinstance(coin.get('market_cap_rank'), int) or not isinstance(coin.get('market_cap'), (int, float)) or coin['market_cap'] <= 0 for coin in coins):
        raise ValueError('Incomplete Coin100 market-cap ranking')
    if len({coin['id'] for coin in coins}) != len(coins):
        raise ValueError('Duplicate CoinGecko identities')
    coins.sort(key=lambda coin: coin['market_cap_rank'])
    if [coin['market_cap_rank'] for coin in coins] != list(range(1, 101)):
        raise ValueError('Coin100 must contain exactly ranks 1 through 100')
    cedears = import_cedears()
    stamp = datetime.now(timezone.utc).isoformat()
    files = {
        'sp500.json': {'retrievedAt': stamp, 'asOf': rows[2].get('B'), 'source': SPY, 'exchangeSource': SEC, 'entries': stocks},
        'crypto.json': {'retrievedAt': stamp, 'source': COINS, 'methodology': 'Top 100 by market capitalization in USD, including stablecoins and wrapped assets; CoinGecko ranking, not a licensed index.', 'marketCapRanks': {coin['id']: coin['market_cap_rank'] for coin in coins}, 'entries': [[coin['id'], coin['symbol'], coin['name']] for coin in coins]},
        'cedears.json': {'retrievedAt': stamp, **cedears},
    }
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, value in files.items():
        target = ROOT / name
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        temporary.replace(target)
    print(f'Imported {len(stocks)} S&P 500 listings, Coin100 ({len(coins)} coins) and {len(cedears["entries"])} CEDEAR programs. BYMA publication: {cedears["asOf"]}')


if __name__ == '__main__':
    main()
