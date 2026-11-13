import { ProviderError } from './types';
type CacheEntry = { expires: number; promise: Promise<unknown> };
const cache = new Map<string, CacheEntry>();
const circuits = new Map<string, { failures: number; until: number }>();
export async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise as Promise<T>;
  if (cache.size > 500) {
    for (const [k, v] of cache) if (v.expires < Date.now()) cache.delete(k);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
  }
  const promise = load().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, { expires: Date.now() + ttl, promise });
  return promise;
}
export async function fetchJson(
  url: URL | string,
  headers?: Record<string, string>,
  beforeAttempt?: () => Promise<void>,
): Promise<unknown> {
  const host = new URL(url).host;
  const circuit = circuits.get(host);
  if (circuit && circuit.until > Date.now())
    throw new ProviderError(
      'Proveedor temporalmente pausado tras fallos repetidos.',
      'CIRCUIT_OPEN',
    );
  for (let attempt = 0; attempt < 2; attempt++) {
    await beforeAttempt?.();
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      });
      if (response.status === 429) {
        circuits.set(host, { failures: 3, until: Date.now() + 60000 });
        throw new ProviderError('Cuota del proveedor agotada.', 'QUOTA');
      }
      if (response.status === 404)
        throw new ProviderError('La fuente no tiene datos para este activo.', 'NOT_FOUND');
      if (!response.ok) throw new ProviderError(`El proveedor respondió HTTP ${response.status}.`);
      const result: unknown = await response.json();
      circuits.delete(host);
      return result;
    } catch (error) {
      if (error instanceof ProviderError && ['QUOTA', 'NOT_FOUND'].includes(error.code))
        throw error;
      if (attempt === 0) continue;
      const failures = (circuits.get(host)?.failures ?? 0) + 1;
      circuits.set(host, { failures, until: failures >= 3 ? Date.now() + 60000 : 0 });
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('No se pudo conectar con el proveedor.');
    }
  }
  throw new ProviderError('Proveedor no disponible.');
}
