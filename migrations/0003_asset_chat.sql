CREATE TABLE IF NOT EXISTS asset_chat_turns (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument_id text NOT NULL REFERENCES instruments(id),
  data_mode text NOT NULL CHECK (data_mode IN ('demo', 'live')),
  question text NOT NULL,
  answer jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_chat_owner_listing_idx ON asset_chat_turns(user_id, instrument_id, data_mode, created_at);
