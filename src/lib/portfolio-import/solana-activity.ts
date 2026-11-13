import Decimal from 'decimal.js';
import { z } from 'zod';
const token = z.object({
  owner: z.string().optional(),
  mint: z.string(),
  uiTokenAmount: z.object({
    amount: z.string().regex(/^\d+$/),
    decimals: z.number().int().min(0).max(36),
  }),
});
const transaction = z.object({
  meta: z.object({
    err: z.unknown(),
    fee: z.number().int().nonnegative(),
    preBalances: z.array(z.number().int().nonnegative()),
    postBalances: z.array(z.number().int().nonnegative()),
    preTokenBalances: z.array(token).optional(),
    postTokenBalances: z.array(token).optional(),
  }),
  transaction: z.object({
    message: z.object({ accountKeys: z.array(z.object({ pubkey: z.string() })) }),
  }),
});
/** Observed balance changes are evidence of flows, not proof of trade execution. */
export function solanaActivity(value: unknown, address: string) {
  const parsed = transaction.safeParse(value);
  if (!parsed.success || parsed.data.meta.err) return null;
  const { meta, transaction: tx } = parsed.data;
  const deltas = new Map<string, Decimal>();
  for (const [rows, sign] of [
    [meta.preTokenBalances ?? [], -1],
    [meta.postTokenBalances ?? [], 1],
  ] as const) {
    for (const row of rows) {
      if (row.owner !== address) continue;
      const quantity = new Decimal(row.uiTokenAmount.amount)
        .div(new Decimal(10).pow(row.uiTokenAmount.decimals))
        .mul(sign);
      deltas.set(row.mint, (deltas.get(row.mint) ?? new Decimal(0)).plus(quantity));
    }
  }
  const index = tx.message.accountKeys.findIndex((key) => key.pubkey === address);
  if (
    index >= 0 &&
    Number.isSafeInteger(meta.preBalances[index]) &&
    Number.isSafeInteger(meta.postBalances[index])
  ) {
    // Exclude the network fee paid by this address. Rent and account creation
    // can still affect SOL, hence the deliberately tentative swap label.
    const change = new Decimal(meta.postBalances[index])
      .minus(meta.preBalances[index])
      .plus(index === 0 ? meta.fee : 0)
      .div('1e9');
    if (!change.isZero()) deltas.set('SOL', change);
  }
  const changed = [...deltas].filter(([, delta]) => !delta.isZero());
  const incoming = changed.some(([, delta]) => delta.gt(0)),
    outgoing = changed.some(([, delta]) => delta.lt(0));
  return {
    kind:
      incoming && outgoing
        ? ('swap' as const)
        : incoming
          ? ('received' as const)
          : outgoing
            ? ('sent' as const)
            : ('transaction' as const),
    label:
      incoming && outgoing
        ? 'Posible intercambio: revisar variaciones de saldo'
        : incoming
          ? 'Entrada de activos'
          : outgoing
            ? 'Salida de activos'
            : 'Sin variación de activos detectada',
    changes: changed.map(([asset, delta]) => ({ asset, quantity: delta.toFixed() })),
    fee: new Decimal(meta.fee).div('1e9').toFixed(),
  };
}
