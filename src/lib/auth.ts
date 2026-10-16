import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { getDb } from './db';
import * as schema from './db/schema';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const globalAuth = globalThis as typeof globalThis & {
  cuantaiAuth?: ReturnType<typeof createAuth>;
};
async function secret() {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_DB !== 'true')
    throw new Error('BETTER_AUTH_SECRET is required');
  const file = path.join(process.cwd(), '.data', 'auth-secret');
  await mkdir(path.dirname(file), { recursive: true });
  try {
    return (await readFile(file, 'utf8')).trim();
  } catch {
    const value = randomBytes(48).toString('hex');
    await writeFile(file, value, { mode: 0o600, flag: 'wx' });
    return value;
  }
}
export function authCapabilities() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    passwordReset: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  };
}
async function createAuth() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_LOCAL_DB !== 'true' &&
    (!process.env.BETTER_AUTH_URL || !process.env.BETTER_AUTH_URL.startsWith('https://'))
  )
    throw new Error('A canonical HTTPS BETTER_AUTH_URL is required in production.');
  return betterAuth({
    appName: 'Cuantai',
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    secret: await secret(),
    database: drizzleAdapter(await getDb(), { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      ...(authCapabilities().passwordReset
        ? {
            sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
              const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: process.env.EMAIL_FROM,
                  to: user.email,
                  subject: 'Recuperá tu acceso a Cuantai',
                  text: `Restablecé tu contraseña: ${url}\nSi no solicitaste el cambio, ignorá este mensaje.`,
                }),
                signal: AbortSignal.timeout(10000),
              });
              if (!res.ok) throw new Error('Email delivery unavailable');
            },
          }
        : {}),
    },
    socialProviders: authCapabilities().google
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 50 },
    advanced: { useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false },
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
  });
}
export async function getAuth() {
  globalAuth.cuantaiAuth ??= createAuth();
  return globalAuth.cuantaiAuth;
}
export async function getSession(headers: Headers) {
  return (await getAuth()).api.getSession({ headers });
}
