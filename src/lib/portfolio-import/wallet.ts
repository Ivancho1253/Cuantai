import Decimal from 'decimal.js';
import { z } from 'zod';
import { getDb } from '../db';
import { instrumentTable } from '../db/schema';
import { findDiscoveryInstrument } from '../market/discovery';
import registry from '../market/data/token-contracts.json';
import type { Instrument } from '../market/types';
import { HttpError } from '../security';
import { solanaActivity } from './solana-activity';
export const walletInput = z.object({
  chain: z.enum(['ethereum', 'solana', 'base', 'arbitrum', 'optimism', 'polygon']),
  address: z.string().trim().max(90),
  cursor: z.string().max(120).optional(),
});
export type WalletActivity = {
  id: string;
  date: string;
  kind: 'swap' | 'received' | 'sent' | 'transaction';
  label: string;
  url: string;
  details: string;
};
export type WalletRead = {
  rows: Record<string, string>[];
  activity: WalletActivity[];
  warnings: string[];
  source: string;
  sourceKey: string;
  completeSnapshot: boolean;
  nextCursor?: string;
  historyComplete: boolean;
};
async function json(url: string, options?: RequestInit) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!r.ok)
    throw new HttpError(
      502,
      `El proveedor de la wallet respondió ${r.status}. Probá nuevamente o importá un archivo.`,
    );
  const text = await r.text();
  if (text.length > 6000000)
    throw new HttpError(502, 'La respuesta de la wallet excede el tamaño admitido');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(502, 'El proveedor no devolvió datos de wallet válidos');
  }
}
const record = z.record(z.string(), z.unknown());
async function rpc(method: string, params: unknown[]) {
  const d = record.parse(
    await json(process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  if (d.error)
    throw new HttpError(
      502,
      'El RPC de Solana no pudo responder. Revisá el límite del proveedor o configurá otro RPC.',
    );
  return d.result;
}
export function isSolanaAddress(value: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  let n = 0n;
  for (const c of value)
    n = n * 58n + BigInt('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.indexOf(c));
  let bytes = 0;
  while (n) {
    bytes++;
    n >>= 8n;
  }
  return bytes + (value.match(/^1*/)?.[0].length ?? 0) === 32;
}
function registered(chain: string, contract: string) {
  const platform =
    chain === 'solana'
      ? 'solana'
      : chain === 'arbitrum'
        ? 'arbitrum-one'
        : chain === 'optimism'
          ? 'optimistic-ethereum'
          : chain === 'polygon'
            ? 'polygon-pos'
            : chain;
  return registry.entries.find((token) => {
    const address = (token.platforms as Record<string, string>)[platform];
    return (
      address &&
      (chain === 'solana' ? address === contract : address.toLowerCase() === contract.toLowerCase())
    );
  });
}
async function walletInstrument(
  chain: string,
  contract: string,
  symbol: string,
  name: string,
): Promise<Instrument> {
  const known = registered(chain, contract);
  const found = known ? findDiscoveryInstrument(`COINGECKO:${known.id}:USD`) : undefined;
  if (found) return found;
  const identity = `${chain}-${contract}`;
  const instrument: Instrument = {
    id: `WALLET:${identity}:USD`,
    exchange: 'WALLET',
    symbol: symbol.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 24) || contract.slice(0, 8),
    name: name.slice(0, 120) || `Token ${contract.slice(0, 8)}`,
    providerSymbol: identity,
    currency: 'USD',
    type: 'crypto',
    country: 'Global',
    sector: 'Wallet token',
    color: '#8fa8a4',
    source: `${chain} · contrato ${contract}`,
  };
  await (
    await getDb()
  )
    .insert(instrumentTable)
    .values({ id: instrument.id, data: instrument })
    .onConflictDoNothing();
  return instrument;
}
const tokenSchema = z.object({
  address_hash: z.string(),
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  decimals: z.string().nullable(),
  type: z.string(),
});
const balanceSchema = z.object({ value: z.string(), token: tokenSchema });
const chainIds = { ethereum: 1, base: 8453, arbitrum: 42161, optimism: 10, polygon: 137 };
async function evmRead(chain: keyof typeof chainIds, address: string): Promise<WalletRead> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address))
    throw new HttpError(400, 'Ingresá una dirección EVM válida, no una clave privada');
  if (chain !== 'ethereum' && !process.env.BLOCKSCOUT_API_KEY)
    throw new HttpError(
      503,
      'Esta red requiere un proveedor de exploración configurado. Ethereum y Solana tienen una opción pública.',
    );
  const root =
    chain === 'ethereum' && !process.env.BLOCKSCOUT_API_KEY
      ? 'https://eth.blockscout.com/api/v2'
      : `https://api.blockscout.com/${chainIds[chain]}/api/v2`;
  const get = (path: string) =>
    json(
      root +
        path +
        (process.env.BLOCKSCOUT_API_KEY
          ? `?apikey=${encodeURIComponent(process.env.BLOCKSCOUT_API_KEY)}`
          : ''),
    );
  const base = `/addresses/${address}`;
  const result = await Promise.allSettled([
    get(base),
    get(base + '/token-balances'),
    get(base + '/token-transfers'),
    get(base + '/transactions'),
  ]);
  if (result[0].status === 'rejected' || result[1].status === 'rejected')
    throw new HttpError(
      502,
      'No se pudieron leer todos los saldos de la wallet. No se preparó una captura incompleta.',
    );
  const info = z.object({ coin_balance: z.string().nullable() }).parse(result[0].value);
  const raw = z
    .array(balanceSchema)
    .parse(result[1].value)
    .filter((item) => item.token.type === 'ERC-20' && new Decimal(item.value).gt(0));
  const rows: Record<string, string>[] = [];
  const warnings: string[] = [];
  const date = new Date().toISOString().slice(0, 10);
  if (info.coin_balance && new Decimal(info.coin_balance).gt(0)) {
    const id =
      chain === 'polygon' ? 'COINGECKO:polygon-ecosystem-token:USD' : 'COINGECKO:ethereum:USD';
    const native = findDiscoveryInstrument(id);
    if (native)
      rows.push({
        instrumentId: native.id,
        symbol: native.symbol,
        quantity: new Decimal(info.coin_balance).div('1e18').toFixed(),
        date,
      });
    else warnings.push('El activo nativo de esta red no está disponible en el catálogo.');
  }
  for (const item of raw.slice(0, 200)) {
    if (
      !/^0x[a-fA-F0-9]{40}$/.test(item.token.address_hash) ||
      !/^\d{1,2}$/.test(item.token.decimals ?? '')
    ) {
      warnings.push('Un token no informó identidad o decimales verificables.');
      continue;
    }
    const decimals = Number(item.token.decimals);
    if (decimals > 36) {
      warnings.push('Un token tiene precisión no admitida.');
      continue;
    }
    const asset = await walletInstrument(
      chain,
      item.token.address_hash.toLowerCase(),
      item.token.symbol ?? '',
      item.token.name ?? '',
    );
    rows.push({
      instrumentId: asset.id,
      symbol: asset.symbol,
      quantity: new Decimal(item.value).div(new Decimal(10).pow(decimals)).toFixed(),
      date,
    });
  }
  const activity: WalletActivity[] = [];
  let nextCursor: string | undefined;
  if (result[2].status === 'fulfilled') {
    const transfers = z
      .object({
        items: z.array(
          z.object({
            transaction_hash: z.string(),
            timestamp: z.string(),
            from: z.object({ hash: z.string() }),
            to: z.object({ hash: z.string() }),
            token: tokenSchema,
            total: z
              .object({ value: z.string().optional(), decimals: z.string().optional() })
              .nullable(),
          }),
        ),
        next_page_params: z.record(z.string(), z.unknown()).nullable(),
      })
      .safeParse(result[2].value);
    if (transfers.success) {
      const groups = new Map<string, typeof transfers.data.items>();
      for (const item of transfers.data.items) {
        const current = groups.get(item.transaction_hash) ?? [];
        current.push(item);
        groups.set(item.transaction_hash, current);
      }
      for (const [hash, items] of groups) {
        if (!/^0x[\da-fA-F]{64}$/.test(hash)) continue;
        const incoming = items.filter(
            (item) => item.to.hash.toLowerCase() === address.toLowerCase(),
          ),
          outgoing = items.filter((item) => item.from.hash.toLowerCase() === address.toLowerCase());
        const swap = incoming.length > 0 && outgoing.length > 0;
        activity.push({
          id: hash,
          date: items[0].timestamp,
          kind: swap ? 'swap' : incoming.length ? 'received' : 'sent',
          label: swap
            ? 'Posible intercambio: entradas y salidas en la misma transacción'
            : incoming.length
              ? 'Transferencia recibida'
              : 'Transferencia enviada',
          url: `https://${chain === 'ethereum' ? 'eth' : chain}.blockscout.com/tx/${hash}`,
          details: items
            .map(
              (item) =>
                `${item.to.hash.toLowerCase() === address.toLowerCase() ? '+' : '−'} ${item.total?.value && item.total.decimals ? new Decimal(item.total.value).div(new Decimal(10).pow(Number(item.total.decimals))).toFixed() : '?'} ${item.token.symbol ?? 'token'}`,
            )
            .join(' · '),
        });
      }
      if (transfers.data.next_page_params) nextCursor = 'more';
    } else warnings.push('No se pudo interpretar el historial del explorador.');
  } else warnings.push('Los saldos se leyeron, pero el historial no estuvo disponible.');
  if (result[3].status === 'fulfilled') {
    const native = z
      .object({
        items: z.array(
          z.object({
            hash: z.string(),
            timestamp: z.string(),
            from: z.object({ hash: z.string() }),
            to: z.object({ hash: z.string() }).nullable(),
            value: z.string(),
            status: z.string(),
          }),
        ),
      })
      .safeParse(result[3].value);
    if (native.success)
      for (const item of native.data.items) {
        if (
          item.status !== 'ok' ||
          activity.some((a) => a.id === item.hash) ||
          !/^0x[\da-fA-F]{64}$/.test(item.hash)
        )
          continue;
        const incoming = item.to?.hash.toLowerCase() === address.toLowerCase();
        activity.push({
          id: item.hash,
          date: item.timestamp,
          kind: new Decimal(item.value).isZero() ? 'transaction' : incoming ? 'received' : 'sent',
          label: new Decimal(item.value).isZero()
            ? 'Interacción con contrato'
            : incoming
              ? 'Transferencia nativa recibida'
              : 'Transferencia nativa enviada',
          details: `${incoming ? '+' : '−'}${new Decimal(item.value).div('1e18').toFixed()} ${chain === 'polygon' ? 'POL' : 'ETH'}`,
          url: `https://${chain === 'ethereum' ? 'eth' : chain}.blockscout.com/tx/${item.hash}`,
        });
      }
  } else warnings.push('El historial de movimientos nativos no estuvo disponible.');
  if (raw.length > 200)
    warnings.push('Se muestran los primeros 200 tokens. La captura no es completa.');
  warnings.push(
    'Una entrada o salida no prueba una compra o venta. Los intercambios se muestran para revisión; no se reconstruye un costo fiscal con información incompleta.',
  );
  return {
    rows,
    activity: activity.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 50),
    source: `Wallet ${chain}`,
    sourceKey: `wallet:${chain}:${address.toLowerCase()}`,
    warnings,
    completeSnapshot: raw.length <= 200 && warnings.length === 1,
    historyComplete: false,
    nextCursor,
  };
}
async function solanaRead(address: string, cursor?: string): Promise<WalletRead> {
  if (!isSolanaAddress(address))
    throw new HttpError(
      400,
      'Ingresá una dirección pública válida de Solana, no una clave privada',
    );
  const balance = z
    .object({ value: z.number().nonnegative() })
    .parse(await rpc('getBalance', [address, { commitment: 'finalized' }]));
  const programs = [
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  ];
  const holdings = new Map<string, Decimal>();
  const warnings: string[] = [];
  for (const programId of programs) {
    const accounts = z
      .object({
        value: z.array(
          z.object({
            account: z.object({
              data: z.object({
                parsed: z.object({
                  info: z.object({
                    mint: z.string(),
                    tokenAmount: z.object({
                      amount: z.string(),
                      decimals: z.number().int().min(0).max(36),
                    }),
                  }),
                }),
              }),
            }),
          }),
        ),
      })
      .parse(
        await rpc('getTokenAccountsByOwner', [
          address,
          { programId },
          { encoding: 'jsonParsed', commitment: 'finalized' },
        ]),
      );
    for (const account of accounts.value) {
      const { mint, tokenAmount } = account.account.data.parsed.info;
      if (!isSolanaAddress(mint)) continue;
      const value = new Decimal(tokenAmount.amount).div(new Decimal(10).pow(tokenAmount.decimals));
      holdings.set(mint, (holdings.get(mint) ?? new Decimal(0)).plus(value));
    }
  }
  const date = new Date().toISOString().slice(0, 10);
  const rows: Record<string, string>[] = [];
  if (!Number.isSafeInteger(balance.value))
    throw new HttpError(502, 'El saldo nativo excede la precisión del proveedor');
  if (balance.value > 0)
    rows.push({
      instrumentId: 'COINGECKO:solana:USD',
      symbol: 'SOL',
      quantity: new Decimal(balance.value).div('1e9').toFixed(),
      date,
    });
  for (const [mint, value] of [...holdings].filter(([, value]) => value.gt(0)).slice(0, 200)) {
    const known = registered('solana', mint);
    const asset = await walletInstrument(
      'solana',
      mint,
      known?.symbol.toUpperCase() ?? `SPL-${mint.slice(0, 5)}`,
      known?.name ?? `SPL token ${mint.slice(0, 8)}`,
    );
    rows.push({ instrumentId: asset.id, symbol: asset.symbol, quantity: value.toFixed(), date });
  }
  const activity: WalletActivity[] = [];
  let nextCursor: string | undefined;
  try {
    const signatures = z
      .array(
        z.object({ signature: z.string(), blockTime: z.number().nullable(), err: z.unknown() }),
      )
      .parse(
        await rpc('getSignaturesForAddress', [
          address,
          { limit: 20, ...(cursor ? { before: cursor } : {}) },
        ]),
      );
    if (signatures.length === 20) nextCursor = signatures.at(-1)!.signature;
    const successful = signatures.filter((i) => !i.err);
    const details = await Promise.allSettled(
      successful
        .slice(0, 5)
        .map((item) =>
          rpc('getTransaction', [
            item.signature,
            { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
          ]),
        ),
    );
    for (const [index, item] of successful.entries()) {
      const detail = details[index];
      const decoded = detail?.status === 'fulfilled' ? solanaActivity(detail.value, address) : null;
      activity.push({
        id: item.signature,
        date: item.blockTime ? new Date(item.blockTime * 1000).toISOString() : '',
        kind: decoded?.kind ?? 'transaction',
        label: decoded?.label ?? 'Transacción confirmada',
        details: decoded
          ? decoded.changes
              .map(
                (change) =>
                  `${new Decimal(change.quantity).gt(0) ? '+' : ''}${change.quantity} ${change.asset === 'SOL' ? 'SOL' : (registered('solana', change.asset)?.symbol.toUpperCase() ?? change.asset)}`,
              )
              .join(' · ') + ` · Comisión: ${decoded.fee} SOL`
          : 'Revisá el detalle para distinguir intercambio, transferencia y comisión.',
        url: `https://solscan.io/tx/${encodeURIComponent(item.signature)}`,
      });
    }
  } catch {
    warnings.push('No se pudo recuperar el historial reciente de Solana.');
  }
  warnings.push(
    'El RPC devuelve actividad reciente de la dirección; el historial de cuentas de tokens puede requerir un indexador. Los saldos no revelan el costo de compra.',
  );
  return {
    rows,
    activity,
    warnings,
    source: 'Wallet Solana',
    sourceKey: `wallet:solana:${address}`,
    completeSnapshot: holdings.size <= 200,
    historyComplete: false,
    nextCursor,
  };
}
export async function readWallet(input: z.infer<typeof walletInput>): Promise<WalletRead> {
  return input.chain === 'solana'
    ? solanaRead(input.address, input.cursor)
    : evmRead(input.chain, input.address);
}
