import { PGlite } from '@electric-sql/pglite';
import { drizzle as pgliteDrizzle } from 'drizzle-orm/pglite';
import { drizzle as postgresDrizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as schema from './schema';
import { instruments } from '../market/catalog';
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
type Connection = {
  db: Database;
  close: () => Promise<void>;
  exec: (sql: string) => Promise<unknown>;
};
const globalDb = globalThis as typeof globalThis & { cuantaiDb?: Promise<Connection> };
export async function connectDatabase(): Promise<Connection> {
  let connection: Connection;
  if (process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, { max: 5, prepare: false });
    connection = {
      db: postgresDrizzle(client, { schema }) as Database,
      close: () => client.end(),
      exec: (sql) => client.unsafe(sql),
    };
  } else {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_DB !== 'true')
      throw new Error(
        'DATABASE_URL required in production. ALLOW_LOCAL_DB=true is only for a single-process local preview.',
      );
    const dataDir = process.env.PGLITE_PATH ?? path.join(process.cwd(), '.data', 'postgres');
    await mkdir(dataDir, { recursive: true });
    const client = new PGlite(dataDir);
    await client.waitReady;
    connection = {
      db: pgliteDrizzle(client, { schema }) as Database,
      close: () => client.close(),
      exec: (sql) => client.exec(sql),
    };
  }
  if (!process.env.DATABASE_URL || process.env.RUN_MIGRATIONS === 'true') await migrate(connection);
  return connection;
}
export async function migrate(connection: Connection) {
  await connection.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamp NOT NULL DEFAULT now())',
  );
  const { sql } = await import('drizzle-orm');
  const folder = path.join(process.cwd(), 'migrations');
  for (const name of (await readdir(folder)).filter((n) => n.endsWith('.sql')).sort()) {
    const applied = await connection.db.execute(
      sql`SELECT name FROM schema_migrations WHERE name=${name}`,
    );
    const rows = resultRows(applied);
    if (Array.isArray(rows) && rows.length) continue;
    await connection.db.transaction(async (tx) => {
      for (const statement of (await readFile(path.join(folder, name), 'utf8'))
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.execute(sql.raw(statement));
      await tx.execute(sql`INSERT INTO schema_migrations(name) VALUES(${name})`);
    });
  }
  await connection.db
    .insert(schema.instrumentTable)
    .values(instruments.map((data) => ({ id: data.id, data })))
    .onConflictDoNothing();
}
export async function getDb() {
  globalDb.cuantaiDb ??= connectDatabase();
  return (await globalDb.cuantaiDb).db;
}

export function resultRows<T = Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && 'rows' in value && Array.isArray(value.rows))
    return value.rows as T[];
  return [];
}
