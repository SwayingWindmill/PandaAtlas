-- Keep the #333 GitHub Actions five-minute pump as the single production
-- scheduler for the NestJS V2 async downstream endpoint.
--
-- 0052 introduced a Supabase Cron fallback while diagnosing the Vercel Hobby
-- scheduling limit. The repository already owns the canonical five-minute
-- GitHub Actions scheduler, so leaving both enabled would create needless
-- duplicate invocations. The worker is idempotent, but a single scheduler is
-- the clearer operational boundary.

begin;

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
end
$scheduler$;

drop function if exists integration.invoke_async_downstream_scheduler();

delete from vault.secrets
where name in (
  'zhipanda_async_downstream_url',
  'zhipanda_async_downstream_secret'
);

commit;
