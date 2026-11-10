import { NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { z, ZodError } from 'zod';
import { getSession, authCapabilities } from '@/lib/auth';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { assertOrigin, HttpError, rateLimit, readJson } from '@/lib/security';
import {
  searchInstruments,
  marketSnapshot,
  marketOverview,
  marketListings,
  resolveInstrument,
  assetFundamentals,
  assetFinancialStatements,
  marketNews,
  providerStatus,
  dataMode,
} from '@/lib/market/service';
import { currencies, timeframes, ProviderError, type Currency } from '@/lib/market/types';
import {
  settingsSchema,
  transactionSchema,
  workspaceSchema,
  quoteInputSchema,
  fxInputSchema,
} from '@/lib/validation';
import { createAnalysis } from '@/lib/ai/analysis';
import { assetOverview } from '@/lib/market/asset-overview';
import { chatInputSchema, type ChatTurn } from '@/lib/ai/asset-chat';
import { answerAssetQuestion } from '@/lib/ai/asset-chat-server';
import { calculatePortfolio, type Transaction } from '@/lib/finance/portfolio';
import { ownedPortfolio, portfolioDetail } from '@/lib/portfolio-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handler(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const route = path.join('/');
    const url = new URL(req.url);
    const demo = url.searchParams.get('demo') === 'true';
    const method = req.method;
    assertOrigin(req);
    if (
      method === 'GET' &&
      !demo &&
      dataMode() === 'live' &&
      [
        'instruments',
        'market',
        'overview',
        'market-catalog',
        'asset-overview',
        'fundamentals',
        'financials',
        'news',
      ].includes(route)
    )
      await rateLimit('market:global', 240, 60);
    if (method === 'GET' && route === 'status')
      return json({ ...providerStatus(), auth: authCapabilities() });
    if (method === 'GET' && route === 'cedear-ratios') {
      const id = z.string().parse(url.searchParams.get('id'));
      const db = await getDb();
      return json(
        await db
          .select()
          .from(s.cedearRatios)
          .where(
            and(
              eq(s.cedearRatios.instrumentId, id),
              lte(s.cedearRatios.effectiveFrom, new Date().toISOString().slice(0, 10)),
            ),
          )
          .orderBy(desc(s.cedearRatios.effectiveFrom)),
      );
    }
    if (method === 'GET' && route === 'instruments')
      return json(
        await searchInstruments(
          (url.searchParams.get('q') ?? '').slice(0, 100),
          dataMode() === 'live' && !demo,
        ),
      );
    if (method === 'GET' && route === 'instrument')
      return json(await resolveInstrument(z.string().min(1).parse(url.searchParams.get('id'))));
    if (method === 'GET' && route === 'market') {
      const id = z.string().min(1).parse(url.searchParams.get('id'));
      const tf = z.enum(timeframes).parse(url.searchParams.get('timeframe') ?? '1D');
      return json(await marketSnapshot(id, tf, demo));
    }
    if (method === 'GET' && route === 'overview') return json(await marketOverview(demo));
    if (method === 'GET' && route === 'market-catalog') {
      const page = z.coerce
        .number()
        .int()
        .positive()
        .max(100000)
        .parse(url.searchParams.get('page') ?? '1');
      const category = z
        .enum([
          'Todos',
          'S&P 500',
          'Estados Unidos',
          'Cripto',
          'Coin100',
          'CEDEARs',
          'Argentina',
          'ETFs',
        ])
        .parse(url.searchParams.get('category') ?? 'Todos');
      return json(
        await marketListings(
          { page, category, query: (url.searchParams.get('q') ?? '').slice(0, 100), pageSize: 50 },
          demo,
        ),
      );
    }
    if (method === 'GET' && route === 'asset-overview')
      return json(await assetOverview(z.string().min(1).parse(url.searchParams.get('id')), demo));
    if (method === 'GET' && route === 'fundamentals')
      return json(
        await assetFundamentals(
          await resolveInstrument(z.string().parse(url.searchParams.get('id'))),
          demo,
        ),
      );
    if (method === 'GET' && route === 'financials')
      return json(
        await assetFinancialStatements(
          await resolveInstrument(z.string().min(1).parse(url.searchParams.get('id'))),
          demo,
        ),
      );
    if (method === 'GET' && route === 'news')
      return json(
        await marketNews(
          url.searchParams.get('id')
            ? await resolveInstrument(url.searchParams.get('id')!)
            : undefined,
          demo,
        ),
      );
    const session = await getSession(req.headers);
    if (!session) throw new HttpError(401, 'Iniciá sesión para guardar tu espacio.');
    const userId = session.user.id;
    const db = await getDb();
    if (method !== 'GET') await rateLimit(`write:${userId}`, 120, 60);
    if (route === 'settings') {
      if (method === 'GET') {
        const [row] = await db.select().from(s.settings).where(eq(s.settings.userId, userId));
        return json({ user: session.user, preferences: row?.preferences ?? {} });
      }
      if (method === 'PUT') {
        const preferences = settingsSchema.parse(await readJson(req));
        await db
          .insert(s.settings)
          .values({ userId, preferences })
          .onConflictDoUpdate({ target: s.settings.userId, set: { preferences } });
        return json({ preferences });
      }
    }
    if (route === 'watchlists') {
      if (method === 'GET') {
        const lists = await db
          .select()
          .from(s.watchlists)
          .where(eq(s.watchlists.userId, userId))
          .orderBy(asc(s.watchlists.createdAt));
        return json(
          await Promise.all(
            lists.map(async (l) => ({
              ...l,
              items: await db
                .select({ id: s.watchlistItems.id, instrument: s.instrumentTable.data })
                .from(s.watchlistItems)
                .innerJoin(
                  s.instrumentTable,
                  eq(s.watchlistItems.instrumentId, s.instrumentTable.id),
                )
                .where(eq(s.watchlistItems.watchlistId, l.id)),
            })),
          ),
        );
      }
      if (method === 'POST') {
        const { name } = z
          .object({ name: z.string().trim().min(1).max(60) })
          .parse(await readJson(req));
        const [list] = await db
          .insert(s.watchlists)
          .values({ id: crypto.randomUUID(), userId, name })
          .returning();
        return json(list, 201);
      }
      if (method === 'PATCH') {
        const body = z
          .object({
            id: z.string(),
            action: z.enum(['add', 'remove', 'delete']),
            instrumentId: z.string().optional(),
          })
          .parse(await readJson(req));
        const [list] = await db
          .select()
          .from(s.watchlists)
          .where(and(eq(s.watchlists.id, body.id), eq(s.watchlists.userId, userId)));
        if (!list) throw new HttpError(404, 'Lista no encontrada');
        if (body.action === 'delete')
          await db.delete(s.watchlists).where(eq(s.watchlists.id, list.id));
        else {
          if (!body.instrumentId) throw new HttpError(400, 'Instrumento requerido');
          await resolveInstrument(body.instrumentId);
          if (body.action === 'add')
            await db
              .insert(s.watchlistItems)
              .values({
                id: crypto.randomUUID(),
                watchlistId: list.id,
                instrumentId: body.instrumentId,
              })
              .onConflictDoNothing();
          else
            await db
              .delete(s.watchlistItems)
              .where(
                and(
                  eq(s.watchlistItems.watchlistId, list.id),
                  eq(s.watchlistItems.instrumentId, body.instrumentId),
                ),
              );
        }
        return json({ ok: true });
      }
    }
    if (route === 'workspaces') {
      if (method === 'GET')
        return json(
          await db
            .select()
            .from(s.workspaces)
            .where(eq(s.workspaces.userId, userId))
            .orderBy(desc(s.workspaces.updatedAt)),
        );
      if (method === 'POST') {
        const body = workspaceSchema.parse(await readJson(req));
        for (const id of body.config.instrumentIds) await resolveInstrument(id);
        if (body.id) {
          const [record] = await db
            .update(s.workspaces)
            .set({ name: body.name, config: body.config, updatedAt: new Date() })
            .where(and(eq(s.workspaces.id, body.id), eq(s.workspaces.userId, userId)))
            .returning();
          if (!record) throw new HttpError(404, 'Workspace no encontrado');
          return json(record);
        }
        const [record] = await db
          .insert(s.workspaces)
          .values({ id: crypto.randomUUID(), userId, name: body.name, config: body.config })
          .returning();
        return json(record, 201);
      }
    }
    if (route === 'portfolios') {
      if (method === 'GET') {
        if (url.searchParams.get('id'))
          return json(await portfolioDetail(userId, url.searchParams.get('id')!));
        return json(
          await db
            .select()
            .from(s.portfolios)
            .where(eq(s.portfolios.userId, userId))
            .orderBy(asc(s.portfolios.createdAt)),
        );
      }
      if (method === 'POST') {
        const body = z
          .object({ name: z.string().trim().min(1).max(80), baseCurrency: z.enum(currencies) })
          .parse(await readJson(req));
        const [p] = await db
          .insert(s.portfolios)
          .values({ id: crypto.randomUUID(), userId, ...body })
          .returning();
        return json(p, 201);
      }
    }
    if (route === 'transactions' && method === 'POST') {
      const body = transactionSchema.parse(await readJson(req));
      const p = await ownedPortfolio(userId, body.portfolioId);
      const instrument = await resolveInstrument(body.instrumentId);
      if (instrument.currency !== body.currency)
        throw new HttpError(400, 'La moneda debe coincidir con la especie exacta.');
      const isCash = instrument.type === 'cash';
      if (['DEPOSIT', 'WITHDRAWAL'].includes(body.type) !== isCash)
        throw new HttpError(400, 'Depósitos y retiros corresponden exclusivamente a efectivo.');
      if (isCash && body.price !== '1')
        throw new HttpError(400, 'El precio unitario del efectivo debe ser 1.');
      const record = { ...body, id: crypto.randomUUID() };
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM portfolios WHERE id=${p.id} FOR UPDATE`);
        const existing = await tx
          .select()
          .from(s.transactions)
          .where(eq(s.transactions.portfolioId, p.id))
          .orderBy(asc(s.transactions.date), asc(s.transactions.createdAt));
        const ids = [...new Set([...existing.map((t) => t.instrumentId), instrument.id])];
        const records = await tx
          .select()
          .from(s.instrumentTable)
          .where(inArray(s.instrumentTable.id, ids));
        const list = records.map((r) => r.data);
        try {
          calculatePortfolio(
            [...existing, record] as Transaction[],
            list,
            [],
            p.baseCurrency as Currency,
          );
        } catch (e) {
          throw new HttpError(400, e instanceof Error ? e.message : 'Transacción inválida');
        }
        await tx.insert(s.transactions).values(record);
      });
      return json(record, 201);
    }
    if (route === 'manual-quotes' && method === 'POST') {
      const body = quoteInputSchema.parse(await readJson(req));
      const listing = await resolveInstrument(body.instrumentId);
      if (listing.type === 'cash')
        throw new HttpError(400, 'Los saldos de efectivo no requieren un precio manual.');
      await db
        .insert(s.manualQuotes)
        .values({ ...body, id: crypto.randomUUID(), userId })
        .onConflictDoUpdate({
          target: [s.manualQuotes.userId, s.manualQuotes.instrumentId],
          set: body,
        });
      return json({ ok: true });
    }
    if (route === 'exchange-rates' && method === 'POST') {
      const body = fxInputSchema.parse(await readJson(req));
      await db
        .insert(s.exchangeRates)
        .values({ ...body, id: crypto.randomUUID(), userId })
        .onConflictDoUpdate({
          target: [s.exchangeRates.userId, s.exchangeRates.from, s.exchangeRates.to],
          set: body,
        });
      return json({ ok: true });
    }
    if (route === 'asset-chat') {
      const input = method === 'POST' ? chatInputSchema.parse(await readJson(req)) : null;
      const instrumentId =
        input?.instrumentId ?? z.string().min(1).max(150).parse(url.searchParams.get('id'));
      const mode = (input?.demo ?? demo) || dataMode() === 'demo' ? 'demo' : 'live';
      await resolveInstrument(instrumentId);
      const scope = and(
        eq(s.chatTurns.userId, userId),
        eq(s.chatTurns.instrumentId, instrumentId),
        eq(s.chatTurns.dataMode, mode),
      );
      const rows = await db
        .select()
        .from(s.chatTurns)
        .where(scope)
        .orderBy(desc(s.chatTurns.createdAt), desc(s.chatTurns.id))
        .limit(31);
      const turns: ChatTurn[] = rows
        .slice(0, 30)
        .reverse()
        .map((row) => ({
          id: row.id,
          question: row.question,
          answer: row.answer,
          createdAt: row.createdAt.toISOString(),
        }));
      if (method === 'GET') return json({ turns, hasMore: rows.length > 30 });
      if (input) {
        const latestId = rows[0]?.id ?? null;
        if (input.baseTurnId !== latestId)
          throw new HttpError(409, 'La conversación cambió. Recargá el historial antes de enviar.');
        await rateLimit(
          `ai:${userId}:${new Date().toISOString().slice(0, 10)}`,
          Number(process.env.AI_DAILY_LIMIT ?? 10),
          86400,
        );
        const overview = await assetOverview(instrumentId, mode === 'demo');
        const news = await marketNews(overview.instrument, mode === 'demo');
        let answer;
        try {
          answer = await answerAssetQuestion(overview, news, input.question, turns);
        } catch {
          throw new HttpError(
            502,
            'La IA no pudo producir una respuesta verificable. Intentá de nuevo; no se guardó una respuesta incompleta.',
          );
        }
        const turn = await db.transaction(async (tx) => {
          // Serialize final appends across processes without holding a lock during model inference.
          await tx
            .select({ id: s.user.id })
            .from(s.user)
            .where(eq(s.user.id, userId))
            .for('update');
          const [latest] = await tx
            .select({ id: s.chatTurns.id })
            .from(s.chatTurns)
            .where(scope)
            .orderBy(desc(s.chatTurns.createdAt), desc(s.chatTurns.id))
            .limit(1);
          if ((latest?.id ?? null) !== latestId)
            throw new HttpError(409, 'Llegó otra respuesta. Recargá el historial antes de enviar.');
          const [saved] = await tx
            .insert(s.chatTurns)
            .values({
              id: crypto.randomUUID(),
              userId,
              instrumentId,
              dataMode: mode,
              question: input.question,
              answer,
              createdAt: new Date(),
            })
            .returning();
          return {
            id: saved.id,
            question: saved.question,
            answer: saved.answer,
            createdAt: saved.createdAt.toISOString(),
          };
        });
        return json(turn, 201);
      }
    }
    if (route === 'analyses') {
      if (method === 'GET')
        return json(
          await db
            .select()
            .from(s.analyses)
            .where(eq(s.analyses.userId, userId))
            .orderBy(desc(s.analyses.createdAt))
            .limit(30),
        );
      if (method === 'POST') {
        const body = z
          .object({ instrumentId: z.string(), question: z.string().max(1000).optional() })
          .parse(await readJson(req));
        await rateLimit(
          `ai:${userId}:${new Date().toISOString().slice(0, 10)}`,
          Number(process.env.AI_DAILY_LIMIT ?? 10),
          86400,
        );
        let report;
        try {
          report = await createAnalysis(body.instrumentId, body.question);
        } catch {
          throw new HttpError(
            502,
            'No se pudo validar el informe. Verificá fuentes, credenciales y disponibilidad del modelo.',
          );
        }
        await db
          .insert(s.analyses)
          .values({ id: report.id, userId, instrumentId: body.instrumentId, report });
        return json(report, 201);
      }
    }
    if (route === 'portfolio-analysis' && method === 'POST') {
      const body = z.object({ portfolioId: z.string() }).parse(await readJson(req));
      const p = await portfolioDetail(userId, body.portfolioId);
      const weights = p.positions
        .filter((i) => i.weight !== null)
        .sort((a, b) => Number(b.weight) - Number(a.weight));
      return json({
        mode: 'deterministic',
        createdAt: new Date().toISOString(),
        title: 'Diagnóstico de concentración',
        largestPosition: weights[0] ?? null,
        positions: p.positions.length,
        complete: p.complete,
        risks: [
          ...(!p.complete
            ? [
                'La valoración está incompleta o usa precios demo/manuales. Revisá las fuentes antes de interpretar pesos.',
              ]
            : []),
          ...(weights[0] && Number(weights[0].weight) > 30
            ? ['La mayor posición supera el 30% del valor calculado.']
            : []),
          ...(p.instruments.filter((i) => i.sector === 'Technology').length > 1
            ? ['Hay varias posiciones del sector tecnológico. Revisá su dependencia común.']
            : []),
        ],
        limitations: [
          'Diagnóstico determinístico, no un informe generado por IA.',
          'Sin correlación, holdings ETF verificados ni series históricas suficientes.',
          'Los rendimientos no incluyen TWR ni XIRR.',
        ],
      });
    }
    throw new HttpError(404, 'Recurso no encontrado');
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError)
      return json(
        { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
        400,
      );
    if (error instanceof ProviderError)
      return json({ error: error.message }, error.code === 'NOT_FOUND' ? 404 : 503);
    console.error(
      JSON.stringify({ event: 'api_error', type: error instanceof Error ? error.name : 'unknown' }),
    );
    return json({ error: 'No se pudo completar la operación. Intentá nuevamente.' }, 500);
  }
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
export { handler as GET, handler as POST, handler as PATCH, handler as PUT };
