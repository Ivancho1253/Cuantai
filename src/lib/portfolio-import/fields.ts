export const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const aliases: Record<string, string[]> = {
  instrumentId: ['instrumentid'],
  symbol: ['ticker', 'symbol', 'simbolo', 'activo', 'asset', 'especie', 'papel', 'token'],
  quantity: [
    'cantidad',
    'quantity',
    'qty',
    'quantidade',
    'units',
    'unidades',
    'balance',
    'saldo',
    'tenencia',
  ],
  price: [
    'precio',
    'price',
    'preco',
    'preciounitario',
    'unitprice',
    'averagecost',
    'costopromedio',
    'preciopromedio',
    'ppc',
    'avgprice',
  ],
  fees: ['fees', 'comision', 'comisiones', 'commission', 'taxa', 'tarifa', 'gastos'],
  date: ['fecha', 'date', 'data', 'datetime', 'timestamp', 'fechadeoperacion'],
  type: ['tipo', 'type', 'operacion', 'operation', 'side', 'action', 'tipodeoperacion'],
  currency: ['moneda', 'currency', 'divisa', 'moeda'],
  exchange: ['mercado', 'exchange', 'bolsa'],
  reference: [
    'referencia',
    'reference',
    'id',
    'orderid',
    'tradeid',
    'txhash',
    'hash',
    'comprobante',
    'numerooperacion',
  ],
  broker: ['broker', 'corretora', 'plataforma'],
  fxRate: ['fxrate', 'tipodecambio', 'cambio'],
};
export function canonicalRow(raw: Record<string, string>) {
  const row: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const n = normalize(key);
    const canonical = Object.entries(aliases).find(([, names]) => names.includes(n))?.[0];
    if (canonical) row[canonical] = value.trim();
  }
  return row;
}
