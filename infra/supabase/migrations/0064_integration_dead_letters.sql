-- Queue messages an integration-event consumer gave up on after repeated failed deliveries (#629).
-- The message is archived from its queue and kept here with the last error until an operator replays
-- or discards it; /health/async reports unhealthy while any row exists.
create table integration.dead_letters (
  dead_letter_id uuid primary key default gen_random_uuid(),
  consumer_key text not null check (consumer_key ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  queue_name text not null check (length(trim(queue_name)) > 0),
  msg_id bigint not null,
  read_count integer not null check (read_count >= 1),
  message jsonb not null,
  error text not null check (length(trim(error)) > 0),
  dead_lettered_at timestamptz not null default now(),
  unique (queue_name, msg_id)
);

-- Integration tables are granted explicitly (0042); the schema has no default ACL for the app role.
grant select, insert on integration.dead_letters to zhipanda_app;
