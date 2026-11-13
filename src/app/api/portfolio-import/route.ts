import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getSession } from '@/lib/auth';
import { assertOrigin, readJson, rateLimit, HttpError } from '@/lib/security';
import { importInputSchema } from '@/lib/portfolio-import/parser';
import { previewImport, confirmImport } from '@/lib/portfolio-import/service';
import { readWallet, walletInput } from '@/lib/portfolio-import/wallet';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  const session = await getSession(req.headers);
  if (!session)
    return NextResponse.json({ error: 'Iniciá sesión para importar tu cartera' }, { status: 401 });
  return NextResponse.json(
    {
      networks: {
        ethereum: true,
        solana: true,
        base: Boolean(process.env.BLOCKSCOUT_API_KEY),
        arbitrum: Boolean(process.env.BLOCKSCOUT_API_KEY),
        optimism: Boolean(process.env.BLOCKSCOUT_API_KEY),
        polygon: Boolean(process.env.BLOCKSCOUT_API_KEY),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const session = await getSession(req.headers);
    if (!session) throw new HttpError(401, 'Iniciá sesión para importar tu cartera');
    const body = z
      .object({ action: z.enum(['preview', 'confirm', 'wallet']) })
      .passthrough()
      .parse(await readJson(req, 512000));
    await rateLimit(`portfolio-import:${session.user.id}`, 30, 60);
    if (body.action === 'preview')
      return NextResponse.json(await previewImport(session.user.id, importInputSchema.parse(body)));
    if (body.action === 'wallet') {
      await rateLimit(`wallet-read:${session.user.id}`, 6, 60);
      return NextResponse.json(await readWallet(walletInput.parse(body)));
    }
    const input = z
      .object({ id: z.uuid(), selectedIds: z.array(z.string()).min(1).max(500) })
      .parse(body);
    return NextResponse.json(await confirmImport(session.user.id, input.id, input.selectedIds));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ZodError
            ? 'Revisá el formato y los campos de la importación'
            : error instanceof HttpError
              ? error.message
              : 'No se pudo procesar la importación. No se guardaron cambios parciales.',
      },
      { status: error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 500 },
    );
  }
}
