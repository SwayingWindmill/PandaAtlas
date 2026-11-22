import process from "node:process";
import { pathToFileURL } from "node:url";
import pg from "pg";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function usage() {
  return [
    "Async downstream dead-letter CLI (mutating actions run inside a rolled-back transaction unless --apply is passed):",
    "  node scripts/development/ops-dead-letters.mjs list [--limit 50] [--json]",
    "  node scripts/development/ops-dead-letters.mjs inspect --id <UUID> [--json]",
    "  node scripts/development/ops-dead-letters.mjs replay --id <UUID> [--apply] [--json]",
    "  node scripts/development/ops-dead-letters.mjs discard --id <UUID> [--apply] [--json]",
  ].join("\n");
}

function readValueFlag(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function requireUuid(value, name) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid UUID`);
  }
  return value;
}

function parseIntFlag(raw, name, min, max) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function parseDeadLetterArgs(argv) {
  if (argv.length === 0 || (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h"))) {
    return { command: "help" };
  }
  const command = argv[0];
  const flags = new Map();
  const valueFlags = new Set(["--limit", "--id"]);
  const boolFlags = new Set(["--json", "--apply"]);

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (flags.has(token)) throw new Error(`Repeated flag: ${token}`);
    if (boolFlags.has(token)) {
      flags.set(token, true);
    } else if (valueFlags.has(token)) {
      flags.set(token, readValueFlag(argv, index, token));
      index += 1;
    } else {
      throw new Error(`Unknown flag: ${token}`);
    }
  }

  const json = flags.get("--json") === true;
  const apply = flags.get("--apply") === true;

  switch (command) {
    case "list": {
      if (apply) throw new Error("--apply is not supported for list");
      const limit = flags.has("--limit") ? parseIntFlag(flags.get("--limit"), "--limit", 1, 200) : 50;
      return { command, limit, json };
    }
    case "inspect": {
      if (apply) throw new Error("--apply is not supported for inspect");
      return { command, id: requireUuid(flags.get("--id"), "--id"), json };
    }
    case "replay":
    case "discard": {
      return { command, id: requireUuid(flags.get("--id"), "--id"), apply, json };
    }
    default:
      throw new Error(`Unknown subcommand: ${command}`);
  }
}

export function resolveDatabaseTarget(env = process.env) {
  const opsUrl = env.PANDAATLAS_OPS_DATABASE_URL?.trim();
  const iamUrl = env.PANDAATLAS_IAM_OPERATOR_DATABASE_URL?.trim();
  const testUrl = env.TEST_DATABASE_URL?.trim();

  let connectionString = opsUrl || iamUrl;
  let host;
  if (connectionString) {
    host = new URL(connectionString).hostname;
  } else if (testUrl) {
    const parsed = new URL(testUrl);
    if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
      connectionString = testUrl;
      host = parsed.hostname;
    }
  }

  if (!connectionString || !host) {
    throw new Error(
      "PANDAATLAS_OPS_DATABASE_URL (or PANDAATLAS_IAM_OPERATOR_DATABASE_URL, or localhost TEST_DATABASE_URL) is required",
    );
  }

  const isLocal = host === "127.0.0.1" || host === "localhost";
  const ca = (env.PANDAATLAS_OPS_DATABASE_SSL_CA_CERT || env.PANDAATLAS_IAM_DATABASE_SSL_CA_CERT || "").trim();
  if (!isLocal && ca === "") {
    throw new Error(
      "PANDAATLAS_OPS_DATABASE_SSL_CA_CERT (or PANDAATLAS_IAM_DATABASE_SSL_CA_CERT) is required for remote hosts",
    );
  }

  return {
    host,
    connectionString,
    ssl: isLocal ? undefined : { ca: ca.replace(/\\n/gu, "\n"), rejectUnauthorized: true },
  };
}

export async function executeDeadLetterCommand(client, parsed) {
  if (parsed.command === "help") {
    return { help: usage() };
  }

  if (parsed.command === "list") {
    const summaryResult = await client.query(
      `select consumer_key, queue_name, count(*)::int as count
       from integration.dead_letters
       group by consumer_key, queue_name
       order by count desc, consumer_key asc`,
    );
    const rowsResult = await client.query(
      `select dead_letter_id, consumer_key, queue_name, msg_id, event_id, read_count, error, dead_lettered_at
       from integration.dead_letters
       order by dead_lettered_at asc
       limit $1`,
      [parsed.limit],
    );
    return {
      mode: "read",
      summary: summaryResult.rows,
      items: rowsResult.rows,
    };
  }

  if (parsed.command === "inspect") {
    const dlqResult = await client.query(
      `select dead_letter_id, consumer_key, queue_name, msg_id, event_id, read_count, message, error, dead_lettered_at
       from integration.dead_letters
       where dead_letter_id = $1`,
      [parsed.id],
    );
    const deadLetter = dlqResult.rows[0];
    if (!deadLetter) {
      throw new Error(`Dead letter ${parsed.id} does not exist`);
    }
    let outboxEvent = null;
    if (deadLetter.event_id) {
      const outboxResult = await client.query(
        `select event_id, event_type, source_context, aggregate_type, aggregate_id, correlation_id, occurred_at, published_at
         from integration.outbox_events
         where event_id = $1`,
        [deadLetter.event_id],
      );
      outboxEvent = outboxResult.rows[0] ?? null;
    }
    return { mode: "read", deadLetter, outboxEvent };
  }

  await client.query("begin");
  try {
    if (parsed.command === "replay") {
      const selected = await client.query(
        `select dead_letter_id, consumer_key, queue_name, msg_id, event_id, message
         from integration.dead_letters
         where dead_letter_id = $1
         for update`,
        [parsed.id],
      );
      const row = selected.rows[0];
      if (!row) {
        throw new Error(`Dead letter ${parsed.id} does not exist`);
      }
      await client.query("select pgmq.send($1, $2::jsonb)", [row.queue_name, JSON.stringify(row.message)]);
      await client.query("delete from integration.dead_letters where dead_letter_id = $1", [parsed.id]);
      if (parsed.apply) {
        await client.query("commit");
        return {
          mode: "applied",
          action: "replay",
          deadLetterId: row.dead_letter_id,
          queueName: row.queue_name,
          consumerKey: row.consumer_key,
          eventId: row.event_id,
        };
      }
      await client.query("rollback");
      return {
        mode: "dry-run",
        action: "replay",
        deadLetterId: row.dead_letter_id,
        queueName: row.queue_name,
        consumerKey: row.consumer_key,
        eventId: row.event_id,
        note: "Dry-run rolled back transaction; pass --apply to replay and delete the dead-letter row.",
      };
    }

    const deleted = await client.query(
      `delete from integration.dead_letters
       where dead_letter_id = $1
       returning dead_letter_id, consumer_key, queue_name, msg_id, event_id`,
      [parsed.id],
    );
    const row = deleted.rows[0];
    if (!row) {
      throw new Error(`Dead letter ${parsed.id} does not exist`);
    }
    if (parsed.apply) {
      await client.query("commit");
      return {
        mode: "applied",
        action: "discard",
        deadLetterId: row.dead_letter_id,
        queueName: row.queue_name,
        consumerKey: row.consumer_key,
        eventId: row.event_id,
      };
    }
    await client.query("rollback");
    return {
      mode: "dry-run",
      action: "discard",
      deadLetterId: row.dead_letter_id,
      queueName: row.queue_name,
      consumerKey: row.consumer_key,
      eventId: row.event_id,
      note: "Dry-run rolled back transaction; pass --apply to permanently discard the dead-letter row.",
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

function printDeadLetterResult(parsed, result) {
  if (result.help) {
    console.log(result.help);
    return;
  }
  if (parsed.json || parsed.command !== "list") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Dead letters listed: ${result.items.length}`);
  for (const group of result.summary) {
    console.log(`- summary: consumer=${group.consumer_key} queue=${group.queue_name} count=${group.count}`);
  }
  for (const item of result.items) {
    console.log(
      `- ${item.dead_letter_id} queue=${item.queue_name} msg_id=${item.msg_id} reads=${item.read_count} at=${item.dead_lettered_at}`,
    );
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  Promise.resolve()
    .then(async () => {
      const parsed = parseDeadLetterArgs(process.argv.slice(2));
      if (parsed.command === "help") {
        console.log(usage());
        return;
      }
      const target = resolveDatabaseTarget(process.env);
      console.error(`Database host: ${target.host}`);
      const client = new pg.Client({
        connectionString: target.connectionString,
        ...(target.ssl === undefined ? {} : { ssl: target.ssl }),
      });
      await client.connect();
      try {
        const result = await executeDeadLetterCommand(client, parsed);
        printDeadLetterResult(parsed, result);
      } finally {
        await client.end();
      }
    })
    .catch((error) => {
      console.error(`[ops-dead-letters] ${error instanceof Error ? error.message : "Operation failed"}`);
      process.exitCode = 1;
    });
}
