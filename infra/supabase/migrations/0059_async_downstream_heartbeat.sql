-- One row recording when the Cron Trigger's async downstream cycle last completed every stage, so an
-- external probe can tell a stalled or failing cycle from an idle one (#560). Seeded at migration time
-- so the first probe after deploy is healthy until the first cycle runs.
create table integration.async_downstream_heartbeat (
  singleton boolean primary key default true check (singleton),
  last_succeeded_at timestamptz not null
);

insert into integration.async_downstream_heartbeat (last_succeeded_at) values (now());

-- Integration tables are granted explicitly (0042); the schema has no default ACL for the app role.
grant select, update on integration.async_downstream_heartbeat to zhipanda_app;
