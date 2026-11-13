import {
  pgTable,
  text,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  integer,
  bigint,
} from 'drizzle-orm/pg-core';
import type { Instrument } from '../market/types';
import type { ChatAnswer } from '../ai/asset-chat';
export const user = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export const session = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);
export const account = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);
export const verification = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export const settings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  preferences: jsonb('preferences').$type<Record<string, unknown>>().notNull().default({}),
});
export const instrumentTable = pgTable('instruments', {
  id: text('id').primaryKey(),
  data: jsonb('data').$type<Instrument>().notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export const watchlists = pgTable(
  'watchlists',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('watchlist_owner_idx').on(t.userId)],
);
export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: text('id').primaryKey(),
    watchlistId: text('watchlist_id')
      .notNull()
      .references(() => watchlists.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrumentTable.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('watchlist_instrument_unique').on(t.watchlistId, t.instrumentId)],
);
export const workspaces = pgTable(
  'chart_workspaces',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('workspace_owner_idx').on(t.userId)],
);
export const portfolios = pgTable(
  'portfolios',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    baseCurrency: text('base_currency').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('portfolio_owner_idx').on(t.userId)],
);
export const transactions = pgTable(
  'portfolio_transactions',
  {
    id: text('id').primaryKey(),
    portfolioId: text('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrumentTable.id),
    type: text('type').notNull(),
    quantity: numeric('quantity', { precision: 38, scale: 18 }).notNull(),
    price: numeric('price', { precision: 38, scale: 18 }).notNull(),
    fees: numeric('fees', { precision: 38, scale: 18 }).notNull().default('0'),
    currency: text('currency').notNull(),
    date: text('date').notNull(),
    fxRate: numeric('fx_rate', { precision: 38, scale: 18 }),
    fxKind: text('fx_kind'),
    fxSource: text('fx_source'),
    broker: text('broker'),
    notes: text('notes'),
    costBasisUnknown: boolean('cost_basis_unknown').notNull().default(false),
    importKey: text('import_key'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('transaction_portfolio_idx').on(t.portfolioId, t.date)],
);
export const portfolioImports = pgTable('portfolio_imports', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  portfolioId: text('portfolio_id')
    .notNull()
    .references(() => portfolios.id, { onDelete: 'cascade' }),
  draft: jsonb('draft').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  appliedAt: timestamp('applied_at'),
  result: jsonb('result').$type<Record<string, unknown>>(),
});
export const manualQuotes = pgTable(
  'manual_quotes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrumentTable.id),
    price: numeric('price', { precision: 38, scale: 18 }).notNull(),
    asOf: text('as_of').notNull(),
    source: text('source').notNull(),
  },
  (t) => [uniqueIndex('manual_quote_owner_listing').on(t.userId, t.instrumentId)],
);
export const exchangeRates = pgTable(
  'exchange_rates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    from: text('from_currency').notNull(),
    to: text('to_currency').notNull(),
    rate: numeric('rate', { precision: 38, scale: 18 }).notNull(),
    asOf: text('as_of').notNull(),
    source: text('source').notNull(),
    kind: text('kind').notNull(),
  },
  (t) => [uniqueIndex('fx_owner_pair').on(t.userId, t.from, t.to)],
);
export const cedearRatios = pgTable(
  'cedear_ratios',
  {
    id: text('id').primaryKey(),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrumentTable.id),
    underlyingId: text('underlying_id')
      .notNull()
      .references(() => instrumentTable.id),
    certificatesPerShare: numeric('certificates_per_share', { precision: 28, scale: 12 }).notNull(),
    effectiveFrom: text('effective_from').notNull(),
    source: text('source').notNull(),
    retrievedAt: timestamp('retrieved_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ratio_effective_unique').on(t.instrumentId, t.effectiveFrom)],
);
export const analyses = pgTable(
  'ai_analyses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id'),
    report: jsonb('report').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('analysis_owner_idx').on(t.userId, t.createdAt)],
);
export const limits = pgTable('request_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const chatTurns = pgTable(
  'asset_chat_turns',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrumentTable.id),
    dataMode: text('data_mode').notNull(),
    question: text('question').notNull(),
    answer: jsonb('answer').$type<ChatAnswer>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('asset_chat_owner_listing_idx').on(t.userId, t.instrumentId, t.dataMode, t.createdAt),
  ],
);

export const rateLimit = pgTable('auth_rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
