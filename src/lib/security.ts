import { sql } from 'drizzle-orm';
import { getDb, resultRows } from './db';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assertOrigin(req: Request) {
  if (['GET', 'HEAD'].includes(req.method)) return;
  const expected = new URL(process.env.BETTER_AUTH_URL ?? req.url).origin;
  const origin = req.headers.get('origin');
  if (origin !== expected) throw new HttpError(403, 'Invalid request origin');
  if (!req.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'JSON required');
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const db = await getDb();
  const now = new Date();
  const expires = new Date(now.getTime() + seconds * 1000);
  const result = await db.execute(
    sql`INSERT INTO request_limits(key,count,expires_at) VALUES(${key},1,${expires}) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_limits.expires_at<${now} THEN 1 ELSE request_limits.count+1 END, expires_at=CASE WHEN request_limits.expires_at<${now} THEN ${expires} ELSE request_limits.expires_at END RETURNING count`,
  );
  const rows = resultRows<{ count: number }>(result);
  if (rows[0].count > limit)
    throw new HttpError(429, 'Límite de solicitudes alcanzado. Intentá nuevamente más tarde.');
}
export async function readJson(req: Request, maxBytes = 64000) {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'Invalid JSON');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, 'Request too large');
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder().decode(combined);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}
