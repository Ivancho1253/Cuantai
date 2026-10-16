# Deployment

The app targets a Node-compatible Next.js host such as Vercel plus managed PostgreSQL. A publication was not requested and no deployment was performed.

## Required configuration

1. Provision PostgreSQL and configure `DATABASE_URL` in the server environment.
2. Generate a long random `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL` to the canonical HTTPS application origin. Configure TLS on the host. Do not use a development `.data/auth-secret` in production.
3. Run `npm ci` and `npm run db:migrate` against that database as a release step. Migrations and catalog seed insertion are versioned/idempotent. Prefer an explicit single migrator; do not enable competing startup migrators across replicas.
4. Build with `npm run build`; start with `npm start` for a Node installation. On a non-local host use `npx next start --hostname 0.0.0.0` with the host's port. `npm start` deliberately binds loopback for local safety.
5. For Vercel, deploy the Next.js project using its native build. Runtime handlers require the Node environment. Leave `ALLOW_LOCAL_DB=false` and `RUN_MIGRATIONS=false`; PGlite disk is not persistent serverless storage.

The app fails closed if a production private route lacks the database or authentication secret. Never put server secrets in `NEXT_PUBLIC_*` variables. `.env.local`, `.data`, provider files and generated artifacts are ignored by Git.

## Optional services

- Google: register `<BETTER_AUTH_URL>/api/auth/callback/google` as the callback and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- Email recovery: configure a verified Resend sender with `RESEND_API_KEY` and `EMAIL_FROM`; absent credentials leave the recovery action disabled with an explicit explanation.
- Market data: configure approved keys and display/redistribution entitlements, upstream budgets and `MARKET_DATA_MODE=live`. Validate each instrument/exchange mapping against the actual plan.
- BYMA: ingest the contracted source into the normalized adapter. A local authorized file works only where the host has persistent accessible storage. Native BYMA and serverless ingestion need implementation after receiving the exact contract/specification.
- AI: configure `OPENAI_API_KEY` and an explicit `AI_MODEL` supporting the Responses API, strict function calling and structured output. `AI_BASE_URL` is optional; a provider must support those APIs. Verify costs/retention/terms and run a credentialed smoke test before calling it production-ready.

## Local production preview

To verify optimized execution without provisioning PostgreSQL, use a separate embedded database strictly for a **single local process**:

```sh
ALLOW_LOCAL_DB=true PGLITE_PATH=.data/production-preview BETTER_AUTH_URL=http://localhost:3100 npm start -- --port 3100
```

This is a local preview exception, not a supported serverless deployment. Stop the process before accessing its PGlite directory from another command.

While that server is running, `PLAYWRIGHT_BASE_URL=http://localhost:3100 npm run test:e2e` runs the browser/API suite against the optimized build. Use a separate preview database because these tests create test accounts and bookkeeping records.

## Operational follow-up

Production release still needs database backup/restore tests, external PostgreSQL integration verification, licensed-provider smoke tests, email/OAuth verification, monitoring, authentication lifecycle cleanup, edge/IP request controls, a privacy/terms review for the actual operator and distributed caching when scaling. Application logs identify error types without logging tokens, raw provider URLs with keys, credentials or full model prompts.

Do not advertise background alerts, streaming price feeds, complete exchange calendars or independent data redistribution rights for this version.
