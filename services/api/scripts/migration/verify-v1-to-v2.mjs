import process from "node:process";
import pg from "pg";

const { Client } = pg;
const index = process.argv.indexOf("--database-url");
const databaseUrl = index >= 0 ? process.argv[index + 1] : process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or --database-url is required");

const checks = [
  ["panda stable IDs", `
    select (
      select count(*) from (
        (select id from public.pandas except select panda_id from panda.pandas)
        union all
        (select panda_id from panda.pandas except select id from public.pandas)
      ) mismatch
    )::bigint as count
  `],
  ["one canonical slug per panda", `
    select count(*)::bigint as count
    from panda.pandas p
    where (select count(*) from panda.slugs s where s.panda_id=p.panda_id and s.slug_kind='canonical') <> 1
  `],
  ["evidence source count", `
    select abs((select count(*) from public.evidence_sources)-(select count(*) from evidence.sources))::bigint as count
  `],
  ["fact assertion count", `
    select abs((select count(*) from public.fact_assertions)-(select count(*) from panda.fact_assertions))::bigint as count
  `],
  ["fact conclusion count", `
    select abs((select count(*) from public.public_fact_conclusions)-(select count(*) from panda.fact_conclusions))::bigint as count
  `],
  ["lineage count", `
    select abs((select count(*) from public.parentage_assertions)-(select count(*) from lineage.parentage_assertions))::bigint as count
  `],
  ["residency count", `
    select abs((select count(*) from public.panda_residencies)-(select count(*) from life_history.residencies))::bigint as count
  `],
  ["life event count", `
    select abs((select count(*) from public.domain_events)-(select count(*) from life_history.events))::bigint as count
  `],
  ["media association count", `
    select abs((select count(*) from public.panda_media)-(select count(*) from media.panda_assets))::bigint as count
  `],
  ["active follows represented as favorites", `
    select count(*)::bigint as count
    from engagement.follows f
    join public.pandas p on p.id::text=f.panda_id or p.slug=f.panda_id
    where f.state='active'
      and not exists (
        select 1 from engagement.favorites favorite
        where favorite.account_id=f.account_id and favorite.panda_id=p.id
      )
  `],
  ["identity account UUIDs still reference Supabase Auth", `
    select count(*)::bigint as count
    from identity.accounts account
    where not exists (select 1 from auth.users auth_user where auth_user.id=account.account_id)
  `],
  ["no migrated media promoted without clearance", `
    select count(*)::bigint as count
    from media.assets asset
    where asset.rights_status <> 'cleared' and asset.eligibility_status='eligible'
  `],
  ["game question count", `
    select abs((select count(*) from game.guess_questions)-(select count(*) from game.questions))::bigint as count
  `],
  ["game attempt count", `
    select abs((select count(*) from engagement.game_attempts)-(select count(*) from game.attempts))::bigint as count
  `],
];

const client = new Client({ connectionString: databaseUrl });
const failures = [];
const started = performance.now();
try {
  await client.connect();
  for (const [name, sql] of checks) {
    const response = await client.query(sql);
    const count = Number(response.rows[0].count);
    if (count !== 0) failures.push({ name, count });
  }
  const report = {
    version: 1,
    passed: failures.length === 0,
    checks: checks.length,
    failures,
    durationMs: Math.round(performance.now() - started),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length > 0) process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
