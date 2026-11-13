ALTER TABLE portfolio_transactions ADD COLUMN IF NOT EXISTS cost_basis_unknown boolean NOT NULL DEFAULT false;
ALTER TABLE portfolio_transactions ADD COLUMN IF NOT EXISTS import_key text;
CREATE UNIQUE INDEX IF NOT EXISTS transaction_import_key ON portfolio_transactions(portfolio_id, import_key) WHERE import_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS portfolio_imports (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portfolio_id text NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  draft jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  applied_at timestamp,
  result jsonb
);
CREATE INDEX IF NOT EXISTS portfolio_import_owner ON portfolio_imports(user_id, portfolio_id, created_at);
