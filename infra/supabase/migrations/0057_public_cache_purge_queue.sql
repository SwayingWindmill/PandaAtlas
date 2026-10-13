-- Delivery changes (release activation, rollback, suspension, restore and resource takedown or
-- restore) purge the Web Worker's public page cache. The purge consumer gets its own retryable
-- queue, like every other integration consumer.
do $queues$
begin
  if to_regprocedure('pgmq.create(text)') is not null
    and to_regclass('pgmq.q_integration_public_cache') is null then
    perform pgmq.create('integration_public_cache');
  end if;
end
$queues$;
