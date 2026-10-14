# Async downstream dead letters

The Updates, Notification and Audit consumers deliver integration events from their PGMQ queues. A message that fails is retried on a later cycle. After its fifth failed read the consumer gives up: it records the message in `integration.dead_letters` with the last error and archives it from the queue. A message that names no existing outbox event is dead-lettered on its first read, since no retry can deliver it. While any dead letter exists, `GET /health/async` answers 503, so the `Production Probe` workflow fails and GitHub sends its failure email.

Each retried failure is logged at `warn` as `Integration event delivery failed; it will be retried`, and each dead letter at `error` as `Integration event dead-lettered`, both with the consumer, queue, message id, read count and error.

## Inspect

In the Supabase SQL editor for the production project:

```sql
select dead_letter_id, consumer_key, queue_name, msg_id, event_id, read_count, message, error, dead_lettered_at
from integration.dead_letters
order by dead_lettered_at;
```

`message` holds the queued payload, normally `{"eventId": "<outbox event id>"}`, and `event_id` the event it names. Read the event with `select * from integration.outbox_events where event_id = '<event_id>'`, and find the matching log entries in Workers Logs by `msgId`.

## Replay

Fix the cause first: deploy the code fix, or repair the data the handler needs. Then put the message back on its queue and remove the dead letter in one transaction:

```sql
begin;
select pgmq.send(queue_name, message) from integration.dead_letters where dead_letter_id = '<dead_letter_id>';
delete from integration.dead_letters where dead_letter_id = '<dead_letter_id>';
commit;
```

The next cycle (at most five minutes later) delivers it. Consumers record a receipt per event, so replaying an event that was already delivered is archived as a duplicate.

## Discard

When the message must never be delivered, for example because its outbox event was never committed, delete the dead letter:

```sql
delete from integration.dead_letters where dead_letter_id = '<dead_letter_id>';
```

`/health/async` reports healthy again once no dead letters remain and the heartbeat is fresh.
