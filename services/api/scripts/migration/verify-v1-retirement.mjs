import process from "node:process";
import pg from "pg";

const { Client } = pg;
const index = process.argv.indexOf("--database-url");
const databaseUrl = index >= 0 ? process.argv[index + 1] : process.env.DATABASE_URL;
const databaseSslCaCert = process.env.DATABASE_SSL_CA_CERT;
if (!databaseUrl) throw new Error("DATABASE_URL or --database-url is required");

const retiredRelations = [
  "public.pandas",
  "public.evidence_sources",
  "public.evidence_attachments",
  "public.panda_names",
  "public.panda_slugs",
  "public.panda_external_identifiers",
  "public.fact_assertions",
  "public.public_fact_conclusions",
  "public.institutions",
  "public.facilities",
  "public.parentage_assertions",
  "public.panda_residencies",
  "public.domain_events",
  "public.media_assets",
  "public.panda_media",
  "public.user_roles",
  "public.admin_import_jobs",
  "public.change_sets",
  "public.publication_batches",
  "public.public_release_pointer",
  "public.archive_release_pointer",
  "engagement.follows",
  "engagement.passport_entries",
  "engagement.notification_preferences",
  "engagement.game_attempts",
  "game.guess_questions",
  "notification.preferences",
  "notification.intents",
  "notification.delivery_jobs",
  "privacy.requests",
  "privacy.retention_policies",
  "privacy.deletion_tombstones",
  "audit.event_facts",
  "audit.export_artifacts",
  "audit.maintenance_runs",
];

const requiredRelations = [
  "public.habitats",
  "public.sightings",
  "public.distribution_snapshots",
  "public.distribution_cells",
  "identity.accounts",
  "integration.outbox_events",
  "evidence.sources",
  "panda.pandas",
  "place.places",
  "life_history.events",
  "lineage.parentage_assertions",
  "media.assets",
  "engagement.favorites",
  "game.questions",
  "community_intake.submissions",
  "review_moderation.review_cases",
  "curation.change_sets",
  "publication.releases",
  "public_read.pandas",
  "updates.items",
  "notification.messages",
  "privacy.subject_requests",
  "audit.evidence_events",
  "pipeline.jobs",
];

const retiredSchemas = ["activity", "feed", "community_curation"];
const retiredFunctionNames = [
  ["public", "has_any_role"],
  ["public", "publish_publication_batch"],
  ["public", "complete_emergency_takedown_followup"],
  ["public", "set_archive_publication_cutover"],
  ["engagement", "reject_append_only_mutation"],
  ["notification", "reject_append_only_mutation"],
  ["privacy", "set_updated_at"],
  ["privacy", "reject_append_only_mutation"],
  ["audit", "project_identity_authorization"],
  ["audit", "project_community_intake"],
  ["audit", "project_review_moderation"],
  ["audit", "project_community_sensitive_read"],
];

const client = new Client({
  connectionString: databaseUrl,
  ...(databaseSslCaCert === undefined
    ? {}
    : { ssl: { ca: databaseSslCaCert, rejectUnauthorized: true } }),
});

const failures = [];
const started = performance.now();

function fail(name, details) {
  failures.push({ name, details });
}

try {
  await client.connect();

  for (const relation of retiredRelations) {
    const response = await client.query("select to_regclass($1) as relation", [relation]);
    if (response.rows[0].relation !== null) fail("retired relation still exists", relation);
  }

  for (const relation of requiredRelations) {
    const response = await client.query("select to_regclass($1) as relation", [relation]);
    if (response.rows[0].relation === null) fail("required V2 relation missing", relation);
  }

  for (const schema of retiredSchemas) {
    const response = await client.query("select to_regnamespace($1) as schema", [schema]);
    if (response.rows[0].schema !== null) fail("retired schema still exists", schema);
  }

  for (const [schema, functionName] of retiredFunctionNames) {
    const response = await client.query(
      `select count(*)::int as count
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = $1 and p.proname = $2`,
      [schema, functionName],
    );
    if (response.rows[0].count !== 0) {
      fail("retired function still exists", `${schema}.${functionName}`);
    }
  }

  const sightingsFk = await client.query(`
    select count(*)::int as count
    from pg_constraint constraint_row
    join pg_class source_table on source_table.oid = constraint_row.conrelid
    join pg_namespace source_schema on source_schema.oid = source_table.relnamespace
    join pg_class target_table on target_table.oid = constraint_row.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where constraint_row.contype = 'f'
      and constraint_row.convalidated
      and source_schema.nspname = 'public'
      and source_table.relname = 'sightings'
      and target_schema.nspname = 'panda'
      and target_table.relname = 'pandas'
  `);
  if (sightingsFk.rows[0].count !== 1) {
    fail("retained sightings Panda FK is not canonical V2", sightingsFk.rows[0].count);
  }

  const legacyPublicPolicies = await client.query(`
    select count(*)::int as count
    from pg_policy policy_row
    join pg_class table_row on table_row.oid = policy_row.polrelid
    join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and table_row.relname in ('habitats', 'sightings', 'distribution_snapshots', 'distribution_cells')
      and policy_row.polname like '%admin_write'
  `);
  if (legacyPublicPolicies.rows[0].count !== 0) {
    fail("retained public compatibility table still has V1 admin policy", legacyPublicPolicies.rows[0].count);
  }

  const legacyAuditTriggers = await client.query(`
    select count(*)::int as count
    from pg_trigger trigger_row
    join pg_class table_row on table_row.oid = trigger_row.tgrelid
    join pg_namespace table_schema on table_schema.oid = table_row.relnamespace
    join pg_proc function_row on function_row.oid = trigger_row.tgfoid
    join pg_namespace function_schema on function_schema.oid = function_row.pronamespace
    where not trigger_row.tgisinternal
      and table_schema.nspname in ('identity', 'community_intake', 'review_moderation')
      and function_schema.nspname = 'audit'
      and function_row.proname in (
        'project_identity_authorization',
        'project_community_intake',
        'project_review_moderation',
        'project_community_sensitive_read'
      )
  `);
  if (legacyAuditTriggers.rows[0].count !== 0) {
    fail("retained V2 table still calls V1 audit projector", legacyAuditTriggers.rows[0].count);
  }

  const legacyCommunityPrivacyColumns = await client.query(`
    select count(*)::int as count
    from information_schema.columns
    where table_schema = 'community_intake'
      and table_name = 'submissions'
      and column_name in (
        'contributor_subject_anonymized_at',
        'contributor_subject_anonymization_request_id'
      )
  `);
  if (legacyCommunityPrivacyColumns.rows[0].count !== 0) {
    fail(
      "Community Intake still carries V1 Privacy request coupling",
      legacyCommunityPrivacyColumns.rows[0].count,
    );
  }

  const identityAuthFk = await client.query(`
    select count(*)::int as count
    from pg_constraint constraint_row
    join pg_class source_table on source_table.oid = constraint_row.conrelid
    join pg_namespace source_schema on source_schema.oid = source_table.relnamespace
    join pg_class target_table on target_table.oid = constraint_row.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where constraint_row.contype = 'f'
      and constraint_row.convalidated
      and source_schema.nspname = 'identity'
      and source_table.relname = 'accounts'
      and target_schema.nspname = 'auth'
      and target_table.relname = 'users'
  `);
  if (identityAuthFk.rows[0].count !== 1) {
    fail("Supabase Auth identity FK changed", identityAuthFk.rows[0].count);
  }

  const migrationLedger = await client.query(`
    select count(*)::int as count
    from supabase_migrations.schema_migrations
    where version = '0051'
  `);
  if (migrationLedger.rows[0].count !== 1) {
    fail("0051 is not recorded exactly once in Supabase migration history", migrationLedger.rows[0].count);
  }

  const report = {
    version: 1,
    passed: failures.length === 0,
    retiredRelations: retiredRelations.length,
    requiredRelations: requiredRelations.length,
    retiredSchemas: retiredSchemas.length,
    retiredFunctionNames: retiredFunctionNames.length,
    failures,
    durationMs: Math.round(performance.now() - started),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length > 0) process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
