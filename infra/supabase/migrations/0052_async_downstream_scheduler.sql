-- Restore the bounded NestJS V2 async pump using Supabase Cron.
--
-- Vercel Hobby does not support minute-level Cron schedules. Scheduling therefore
-- lives beside the canonical PostgreSQL/PGMQ state while the actual worker logic
-- remains owned by NestJS at /internal/jobs/async-downstream.
--
-- The endpoint URL and bearer secret are environment-specific and live in
-- Supabase Vault. Environments without those Vault entries intentionally no-op,
-- so a fresh local/staging reset never calls production.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function integration.invoke_async_downstream_scheduler()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  endpoint_url text;
  bearer_secret text;
  request_id bigint;
begin
  select decrypted_secret
    into endpoint_url
  from vault.decrypted_secrets
  where name = 'zhipanda_async_downstream_url'
  limit 1;

  select decrypted_secret
    into bearer_secret
  from vault.decrypted_secrets
  where name = 'zhipanda_async_downstream_secret'
  limit 1;

  if endpoint_url is null or btrim(endpoint_url) = ''
     or bearer_secret is null or btrim(bearer_secret) = '' then
    return null;
  end if;

  select net.http_get(
    url := endpoint_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || bearer_secret),
    timeout_milliseconds := 60000
  )
  into request_id;

  return request_id;
end
$function$;

revoke all on function integration.invoke_async_downstream_scheduler() from public;
revoke all on function integration.invoke_async_downstream_scheduler() from anon;
revoke all on function integration.invoke_async_downstream_scheduler() from authenticated;

do $scheduler$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'zhipanda-async-downstream'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'zhipanda-async-downstream',
    '*/5 * * * *',
    $cron$select integration.invoke_async_downstream_scheduler();$cron$
  );
end
$scheduler$;

comment on function integration.invoke_async_downstream_scheduler() is
  'Supabase Cron entrypoint for the bounded NestJS V2 async downstream worker; reads environment URL/secret from Vault and no-ops when unconfigured.';

commit;
