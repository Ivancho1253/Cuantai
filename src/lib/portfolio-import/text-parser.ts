export function receiptRows(text: string, mode: 'trades' | 'holdings'): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const date = text.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{2}[/.]\d{2}[/.]\d{4}\b/)?.[0] ?? '';
  const tabular = lines.flatMap((line) => {
    const m = line.match(/^([A-Z][A-Z0-9.]{1,12})\s+([\d.,]+)\s+([\d.,]+)(?:\s+(ARS|USD|USDT))?$/);
    return m
      ? [
          {
            symbol: m[1],
            quantity: m[2],
            price: m[3],
            currency: m[4] ?? '',
            type:
              mode === 'trades'
                ? /venta|sell|venda/i.test(text)
                  ? 'SELL'
                  : /compra|buy|purchase/i.test(text)
                    ? 'BUY'
                    : ''
                : '',
            date,
          },
        ]
      : [];
  });
  if (tabular.length) return tabular;
  const field = (label: string) =>
    text.match(new RegExp(`(?:${label})\\s*[:=]?\\s*([^\\r\\n]+)`, 'i'))?.[1]?.trim() ?? '';
  return [
    {
      symbol:
        field('ticker|s[ií]mbolo|especie|activo|asset').match(/[A-Z][A-Z0-9.]{1,14}/)?.[0] ?? '',
      quantity: field('cantidad|quantity|quantidade|unidades').match(/[\d.,]+/)?.[0] ?? '',
      price: field('precio(?: unitario)?|price|pre[cç]o').match(/[\d.,]+/)?.[0] ?? '',
      fees: field('comisi[oó]n|fees|taxa').match(/[\d.,]+/)?.[0] ?? '',
      currency: text.match(/\b(?:ARS|USD|USDT)\b/)?.[0] ?? '',
      date,
      type: /venta|sell|venda/i.test(text)
        ? 'SELL'
        : /compra|buy|purchase/i.test(text)
          ? 'BUY'
          : '',
    },
  ];
}
