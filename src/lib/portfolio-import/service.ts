import { createHash } from 'node:crypto';
import Decimal from 'decimal.js';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db';
import * as s from '../db/schema';
import { ownedPortfolio } from '../portfolio-service';
import { resolveInstrument } from '../market/service';
import { calculatePortfolio, type Transaction } from '../finance/portfolio';
import type { Instrument, Currency } from '../market/types';
import { HttpError } from '../security';
import { buildImportRows, canonicalRow, type DraftRow, type ImportInput } from './parser';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const version = (rows: Transaction[]) =>
  hash(
    rows
      .map((row) => [
        row.id,
        row.instrumentId,
        row.quantity,
        row.price,
        row.fees,
        row.type,
        row.date,
        row.currency,
        row.fxRate,
        row.costBasisUnknown,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
function rowKey(row: Omit<Transaction, 'id'>, reference?: string) {
  return hash(
    reference
      ? [row.instrumentId, row.type, row.broker, reference]
      : [
          row.instrumentId,
          row.type,
          new Decimal(row.quantity).toFixed(),
          new Decimal(row.price).toFixed(),
          new Decimal(row.fees).toFixed(),
          row.currency,
          row.date,
          row.fxRate,
        ],
  );
}
export type ImportDraft = {
  expiresAt: number;
  version: string;
  source: string;
  sourceKey?: string;
  mode: ImportInput['mode'];
  rows: DraftRow[];
};
export async function previewImport(userId: string, input: ImportInput) {
  const portfolio = await ownedPortfolio(userId, input.portfolioId);
  const db = await getDb();
  const existing = await db
    .select()
    .from(s.transactions)
    .where(eq(s.transactions.portfolioId, portfolio.id))
    .orderBy(asc(s.transactions.date), asc(s.transactions.createdAt));
  const priorImports =
    input.mode === 'holdings' && input.sourceKey
      ? await db
          .select()
          .from(s.portfolioImports)
          .where(
            and(
              eq(s.portfolioImports.userId, userId),
              eq(s.portfolioImports.portfolioId, portfolio.id),
              sql`${s.portfolioImports.draft}->>'sourceKey' = ${input.sourceKey}`,
            ),
          )
          .orderBy(desc(s.portfolioImports.createdAt))
          .limit(1000)
      : [];
  if (priorImports.length === 1000)
    throw new HttpError(
      409,
      'El historial de esta wallet requiere una conciliación antes de continuar.',
    );
  // A wallet contributes its own balance delta. A second wallet must not replace
  // holdings imported from the first wallet or entered manually.
  const sourceHoldings = new Map<string, DraftRow>();
  for (const entry of priorImports) {
    if (!entry.appliedAt) continue;
    const draft = entry.draft as unknown as ImportDraft;
    const selected = new Set((entry.result?.selectedIds as string[] | undefined) ?? []);
    for (const row of draft.rows) {
      if (selected.has(row.id) && row.instrument && !sourceHoldings.has(row.instrument.id))
        sourceHoldings.set(row.instrument.id, row);
    }
  }
  const extraInstruments = (
    await Promise.all(
      input.rows
        .map((raw) => canonicalRow(raw).instrumentId)
        .filter(Boolean)
        .map((id) => resolveInstrument(id).catch(() => null)),
    )
  ).filter((i): i is Instrument => i !== null);
  let rows = buildImportRows(input, extraInstruments);
  if (input.mode === 'holdings' && input.completeSnapshot && input.sourceKey) {
    if (sourceHoldings.size) {
      const present = new Set(rows.filter((r) => r.instrument).map((r) => r.instrument!.id));
      const date = Object.values(rows.find((r) => r.transaction)?.transaction ?? {}).length
        ? rows.find((r) => r.transaction)!.transaction!.date
        : new Date().toISOString().slice(0, 10);
      const zeros = [...sourceHoldings.values()]
        .filter(
          (r) =>
            r.instrument &&
            !present.has(r.instrument.id) &&
            new Decimal(r.targetQuantity ?? 0).gt(0),
        )
        .map((r) => ({ instrumentId: r.instrument!.id, quantity: '0', date }));
      if (zeros.length) {
        const prior = await Promise.all(zeros.map((row) => resolveInstrument(row.instrumentId)));
        rows = buildImportRows({ ...input, rows: [...input.rows, ...zeros] }, [
          ...extraInstruments,
          ...prior,
        ]);
      }
    }
  }
  const ids = [
    ...new Set([
      ...existing.map((row) => row.instrumentId),
      ...rows.flatMap((row) => (row.instrument ? [row.instrument.id] : [])),
    ]),
  ];
  const instruments = await Promise.all(ids.map(resolveInstrument));
  const current = calculatePortfolio(
    existing as Transaction[],
    instruments,
    [],
    portfolio.baseCurrency as Currency,
  );
  const held = new Map(current.positions.map((p) => [p.instrumentId, p.quantity]));
  const duplicateKeys = new Set(existing.map((row) => row.importKey ?? rowKey(row as Transaction)));
  const accepted: Transaction[] = [];
  for (const row of [...rows].sort(
    (a, b) =>
      (a.transaction?.date ?? '').localeCompare(b.transaction?.date ?? '') ||
      Number(a.id) - Number(b.id),
  )) {
    if (row.errors.length || !row.transaction || !row.instrument) continue;
    const tx = row.transaction;
    if (input.mode === 'holdings') {
      if (existing.some((old) => old.instrumentId === tx.instrumentId && old.date > tx.date)) {
        row.errors.push('La captura es anterior a movimientos ya registrados de este activo');
        continue;
      }
      const previous = new Decimal(
          input.sourceKey?.startsWith('wallet:')
            ? (sourceHoldings.get(tx.instrumentId)?.targetQuantity ?? 0)
            : (held.get(tx.instrumentId) ?? 0),
        ),
        delta = new Decimal(row.targetQuantity!).minus(previous);
      if (delta.isZero()) {
        row.duplicate = true;
        row.warnings.push('El saldo coincide con la cartera: no hay cambios.');
        continue;
      }
      tx.quantity = delta.abs().toFixed();
      tx.type = delta.isPositive() ? 'TRANSFER_IN' : 'TRANSFER_OUT';
      if (delta.isPositive() && new Decimal(held.get(tx.instrumentId) ?? 0).gt(0))
        tx.costBasisUnknown = true;
      tx.fees = '0';
      if (row.instrument.type === 'cash') {
        tx.type = delta.isPositive() ? 'DEPOSIT' : 'WITHDRAWAL';
        tx.price = '1';
        tx.costBasisUnknown = false;
      }
      row.warnings.push(`Cambio de cantidad: ${previous.toFixed()} → ${row.targetQuantity}`);
      row.importKey = hash([
        input.sourceKey ?? input.source,
        tx.instrumentId,
        tx.date,
        row.targetQuantity,
        version(existing as Transaction[]),
      ]);
    } else row.importKey = rowKey(tx, canonicalRow(row.raw).reference);
    if (duplicateKeys.has(row.importKey)) {
      row.duplicate = true;
      row.warnings.push(
        'Ya hay una operación equivalente. Si es otra orden, agregá su referencia.',
      );
      continue;
    }
    try {
      calculatePortfolio(
        [...existing, ...accepted, { ...tx, id: row.id }] as Transaction[],
        instruments,
        [],
        portfolio.baseCurrency as Currency,
      );
      accepted.push({ ...tx, id: row.id });
      duplicateKeys.add(row.importKey);
    } catch (e) {
      row.errors.push((e as Error).message);
    }
  }
  const draft: ImportDraft = {
    expiresAt: Date.now() + 30 * 60 * 1000,
    version: version(existing as Transaction[]),
    source: input.source,
    sourceKey: input.sourceKey,
    mode: input.mode,
    rows,
  };
  const id = crypto.randomUUID();
  await db.insert(s.portfolioImports).values({
    id,
    userId,
    portfolioId: portfolio.id,
    draft: draft as unknown as Record<string, unknown>,
    createdAt: new Date(),
  });
  return {
    id,
    rows,
    valid: rows.filter((r) => !r.errors.length && !r.duplicate).length,
    source: input.source,
    mode: input.mode,
  };
}
export async function confirmImport(userId: string, id: string, selectedIds: string[]) {
  const db = await getDb();
  const [preview] = await db
    .select()
    .from(s.portfolioImports)
    .where(and(eq(s.portfolioImports.id, id), eq(s.portfolioImports.userId, userId)));
  if (!preview) throw new HttpError(404, 'Importación no encontrada');
  const portfolio = await ownedPortfolio(userId, preview.portfolioId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM portfolios WHERE id=${portfolio.id} FOR UPDATE`);
    const [record] = await tx
      .select()
      .from(s.portfolioImports)
      .where(and(eq(s.portfolioImports.id, id), eq(s.portfolioImports.userId, userId)))
      .for('update');
    if (record.appliedAt) return record.result;
    const draft = record.draft as unknown as ImportDraft;
    if (!draft.expiresAt || Date.now() > draft.expiresAt)
      throw new HttpError(409, 'La vista previa venció. Volvé a revisar el archivo.');
    const existing = await tx
      .select()
      .from(s.transactions)
      .where(eq(s.transactions.portfolioId, portfolio.id))
      .orderBy(asc(s.transactions.date), asc(s.transactions.createdAt));
    if (version(existing as Transaction[]) !== draft.version)
      throw new HttpError(
        409,
        'La cartera cambió. Generá una nueva vista previa antes de importar.',
      );
    const selected = new Set(selectedIds);
    const rows = draft.rows.filter((row) => selected.has(row.id));
    if (
      !rows.length ||
      rows.length !== selected.size ||
      rows.some((row) => row.errors.length || row.duplicate || !row.transaction)
    )
      throw new HttpError(400, 'Revisá las filas seleccionadas');
    const ids = [
      ...new Set([
        ...existing.map((row) => row.instrumentId),
        ...rows.map((row) => row.transaction!.instrumentId),
      ]),
    ];
    const instruments = await tx
      .select()
      .from(s.instrumentTable)
      .where(inArray(s.instrumentTable.id, ids));
    const now = Date.now();
    const values = rows.map((row, index) => ({
      ...row.transaction!,
      id: crypto.randomUUID(),
      portfolioId: portfolio.id,
      importKey: row.importKey,
      costBasisUnknown: row.transaction!.costBasisUnknown ?? false,
      createdAt: new Date(now + index),
    }));
    try {
      calculatePortfolio(
        [...existing, ...values] as Transaction[],
        instruments.map((row) => row.data) as Instrument[],
        [],
        portfolio.baseCurrency as Currency,
      );
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    await tx.insert(s.transactions).values(values);
    const result = {
      imported: values.length,
      portfolioId: portfolio.id,
      selectedIds: [...selected],
    };
    await tx
      .update(s.portfolioImports)
      .set({ appliedAt: new Date(), result })
      .where(eq(s.portfolioImports.id, id));
    return result;
  });
}
