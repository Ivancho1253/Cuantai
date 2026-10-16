CREATE TABLE IF NOT EXISTS auth_rate_limits (id text PRIMARY KEY,key text NOT NULL UNIQUE,count integer NOT NULL,last_request bigint NOT NULL);
