-- Collector database. Applied idempotently by `collector migrate`.

CREATE TABLE IF NOT EXISTS targets (
  id                   text PRIMARY KEY,
  adapter              text NOT NULL,
  kind                 text NOT NULL CHECK (kind IN ('account', 'keyword', 'feed')),
  value                text NOT NULL,
  label                text NOT NULL,
  tier                 text NOT NULL CHECK (tier IN ('official', 'key_account', 'keyword', 'backfill')),
  params               jsonb NOT NULL DEFAULT '{}',
  interval_minutes     integer NOT NULL CHECK (interval_minutes > 0),
  enabled              boolean NOT NULL DEFAULT true,
  cursor               jsonb,
  next_run_at          timestamptz NOT NULL DEFAULT now(),
  consecutive_failures integer NOT NULL DEFAULT 0,
  consecutive_empty    integer NOT NULL DEFAULT 0,
  last_success_at      timestamptz,
  last_error           text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS targets_due_idx ON targets (next_run_at) WHERE enabled;

-- An adapter-wide pause: login expired, rate limited or challenged. Other adapters keep running.
CREATE TABLE IF NOT EXISTS adapter_state (
  adapter      text PRIMARY KEY,
  paused_until timestamptz,
  reason       text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  id          bigserial PRIMARY KEY,
  target_id   text NOT NULL REFERENCES targets (id) ON DELETE CASCADE,
  adapter     text NOT NULL,
  started_at  timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  status      text NOT NULL CHECK (status IN ('ok', 'empty', 'failed', 'skipped')),
  error_kind  text,
  error       text,
  fetched     integer NOT NULL DEFAULT 0,
  created     integer NOT NULL DEFAULT 0,
  revised     integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS runs_target_idx ON runs (target_id, started_at DESC);
CREATE INDEX IF NOT EXISTS runs_started_idx ON runs (started_at);

-- Raw content. Rows are never deleted; classification only adds columns.
CREATE TABLE IF NOT EXISTS items (
  id               bigserial PRIMARY KEY,
  platform         text NOT NULL,
  platform_item_id text NOT NULL,
  url              text NOT NULL,
  title            text NOT NULL,
  body             text NOT NULL DEFAULT '',
  author_id        text,
  author_name      text,
  published_at     timestamptz,
  media            jsonb NOT NULL DEFAULT '[]',
  metrics          jsonb NOT NULL DEFAULT '{}',
  raw              jsonb NOT NULL DEFAULT '{}',
  content_hash     text NOT NULL,
  version          integer NOT NULL DEFAULT 1,
  panda_slugs      text[] NOT NULL DEFAULT '{}',
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, platform_item_id)
);
CREATE INDEX IF NOT EXISTS items_published_idx ON items (published_at DESC);
CREATE INDEX IF NOT EXISTS items_pandas_idx ON items USING gin (panda_slugs);

-- Every distinct content of an item, version 1 included.
CREATE TABLE IF NOT EXISTS item_versions (
  item_id      bigint NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  version      integer NOT NULL,
  captured_at  timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  media        jsonb NOT NULL,
  raw          jsonb NOT NULL,
  PRIMARY KEY (item_id, version)
);

-- Which target found an item and when. Drives coverage and per-collector discovery latency.
CREATE TABLE IF NOT EXISTS item_sightings (
  item_id       bigint NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  target_id     text NOT NULL REFERENCES targets (id) ON DELETE CASCADE,
  adapter       text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, target_id)
);

-- Versions waiting to be pushed to AIHOT.
CREATE TABLE IF NOT EXISTS outbox (
  item_id    bigint NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  version    integer NOT NULL,
  target_id  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  pushed_at  timestamptz,
  attempts   integer NOT NULL DEFAULT 0,
  last_error text,
  PRIMARY KEY (item_id, version)
);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox (created_at) WHERE pushed_at IS NULL;

CREATE TABLE IF NOT EXISTS alerts (
  id          bigserial PRIMARY KEY,
  raised_at   timestamptz NOT NULL DEFAULT now(),
  adapter     text NOT NULL,
  target_id   text,
  kind        text NOT NULL,
  message     text NOT NULL,
  notified_at timestamptz,
  resolved_at timestamptz
);
-- One open alert per (adapter, target, kind): a repeat failure does not page again.
CREATE UNIQUE INDEX IF NOT EXISTS alerts_open_idx
  ON alerts (adapter, coalesce(target_id, ''), kind) WHERE resolved_at IS NULL;
