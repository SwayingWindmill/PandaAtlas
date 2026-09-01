import { writeFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const localRehearsal = process.argv.includes("--rehearse-local");
const apply = process.argv.includes("--apply") || localRehearsal;
const databaseUrl = localRehearsal
  ? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  : option("--database-url") ?? process.env.DATABASE_URL;
const reportPath = option("--report");
const databaseSslCaCert = process.env.DATABASE_SSL_CA_CERT;

if (!databaseUrl) throw new Error("DATABASE_URL or --database-url is required");
if (process.argv.includes("--database-url") && !option("--database-url")) {
  throw new Error("--database-url requires a connection string");
}
if (process.argv.includes("--report") && !reportPath) {
  throw new Error("--report requires a file path");
}

const sourceCounts = {
  pandas: "select count(*)::bigint as count from public.pandas",
  evidenceSources: "select count(*)::bigint as count from public.evidence_sources",
  factAssertions: "select count(*)::bigint as count from public.fact_assertions",
  factConclusions: "select count(*)::bigint as count from public.public_fact_conclusions",
  institutions: "select count(*)::bigint as count from public.institutions",
  facilities: "select count(*)::bigint as count from public.facilities",
  residencies: "select count(*)::bigint as count from public.panda_residencies",
  lifeEvents: "select count(*)::bigint as count from public.domain_events",
  lineage: "select count(*)::bigint as count from public.parentage_assertions",
  linkedMedia: "select count(*)::bigint as count from public.panda_media",
  activeFollows: "select count(*)::bigint as count from engagement.follows where state = 'active'",
};

const targetCounts = {
  pandas: "select count(*)::bigint as count from panda.pandas",
  evidenceSources: "select count(*)::bigint as count from evidence.sources",
  factAssertions: "select count(*)::bigint as count from panda.fact_assertions",
  factConclusions: "select count(*)::bigint as count from panda.fact_conclusions",
  institutions: "select count(*)::bigint as count from place.institutions",
  places: "select count(*)::bigint as count from place.places",
  residencies: "select count(*)::bigint as count from life_history.residencies",
  lifeEvents: "select count(*)::bigint as count from life_history.events",
  lineage: "select count(*)::bigint as count from lineage.parentage_assertions",
  mediaAssets: "select count(*)::bigint as count from media.assets",
  favorites: "select count(*)::bigint as count from engagement.favorites",
  notificationPreferences: "select count(*)::bigint as count from notification.channel_preferences",
  gameQuestions: "select count(*)::bigint as count from game.questions",
  gameAttempts: "select count(*)::bigint as count from game.attempts",
};

const preflightChecks = [
  {
    key: "liveV2Release",
    description: "V2 already has a current release pointer",
    sql: "select count(*)::bigint as count from publication.current_release",
  },
  {
    key: "unresolvedActiveFollows",
    description: "active Follow rows do not resolve to a V1 panda UUID or canonical base slug",
    sql: `
      select count(*)::bigint as count
      from engagement.follows f
      where f.state = 'active'
        and not exists (
          select 1 from public.pandas p
          where p.id::text = f.panda_id or p.slug = f.panda_id
        )
    `,
  },
  {
    key: "unreconciledBootstrapRoles",
    description: "legacy public.user_roles lacks an equivalent active Identity role assignment",
    sql: `
      select count(*)::bigint as count
      from public.user_roles legacy
      where not exists (
        select 1
        from identity.role_assignments assignment
        left join identity.role_assignment_revocations revocation
          on revocation.assignment_id = assignment.assignment_id
        where assignment.account_id = legacy.user_id
          and assignment.role_key = case legacy.role::text
            when 'admin' then 'administrator'
            when 'editor' then 'archive_editor'
            when 'reviewer' then 'reviewer'
          end
          and revocation.assignment_id is null
          and (assignment.expires_at is null or assignment.expires_at > now())
      )
    `,
  },
  {
    key: "unfinishedCommunityCuration",
    description: "legacy Community Curation bridge work is not fully projected",
    sql: `
      select count(*)::bigint as count
      from community_curation.assertion_bridges
      where status::text <> 'projected'
    `,
  },
  {
    key: "openLegacyPrivacyRequests",
    description: "legacy Privacy requests are still open",
    sql: `
      select count(*)::bigint as count
      from privacy.requests
      where state::text in ('requested', 'verified', 'processing')
    `,
  },
  {
    key: "canonicalSlugConflict",
    description: "public.pandas base slug conflicts with a trusted slug owned by another panda",
    sql: `
      select count(*)::bigint as count
      from public.pandas p
      join public.panda_slugs s on s.slug = p.slug and s.panda_id <> p.id
    `,
  },
  {
    key: "mediaMissingObjectFacts",
    description: "linked V1 media lacks V2-required object checksum, byte size, media type, or object-key identity",
    sql: `
      select count(distinct media.id)::bigint as count
      from public.media_assets media
      join public.panda_media link on link.media_id = media.id
      where coalesce(media.metadata->>'content_sha256', media.metadata->>'sha256', '') !~ '^[0-9a-f]{64}$'
         or coalesce(media.metadata->>'byte_size', media.metadata->>'bytes', '') !~ '^[0-9]+$'
         or coalesce(media.metadata->>'byte_size', media.metadata->>'bytes', '0')::numeric <= 0
         or coalesce(media.metadata->>'media_type', media.metadata->>'mime_type', '') = ''
         or media.storage_path ~* '^https?://'
    `,
  },
  {
    key: "unresolvedLegacyGameTarget",
    description: "legacy Guess Panda question target is missing from V1 panda authority",
    sql: `
      select count(*)::bigint as count
      from game.guess_questions question
      where not exists (select 1 from public.pandas panda where panda.id = question.panda_id)
    `,
  },
  {
    key: "ambiguousLegacyGameMedia",
    description: "legacy Guess Panda media reference does not resolve to exactly one linked V1 media row",
    sql: `
      select count(*)::bigint as count
      from game.guess_questions question
      where (
        select count(*)
        from public.media_assets media
        where exists (select 1 from public.panda_media link where link.media_id = media.id)
          and (
            media.id::text = question.media_id
            or media.metadata->>'public_media_id' = question.media_id
            or media.metadata->>'media_id' = question.media_id
          )
      ) <> 1
    `,
  },
  {
    key: "ambiguousLegacyGameAttempts",
    description: "legacy game attempt target/question or selected panda cannot be mapped unambiguously",
    sql: `
      select count(*)::bigint as count
      from engagement.game_attempts attempt
      where (
        select count(*)
        from game.guess_questions question
        join public.pandas target on target.id = question.panda_id
        where target.id::text = attempt.target_panda_id or target.slug = attempt.target_panda_id
      ) <> 1
      or not exists (
        select 1 from public.pandas selected
        where selected.id::text = attempt.selected_panda_id or selected.slug = attempt.selected_panda_id
      )
    `,
  },
];

const clearTargetSql = [
  "delete from game.attempts",
  "delete from game.questions",
  "delete from notification.provider_dead_letters",
  "delete from notification.provider_attempts",
  "delete from notification.provider_jobs",
  "delete from notification.message_channels",
  "delete from notification.messages",
  "delete from notification.channel_preferences",
  "delete from engagement.favorites",
  "delete from media.panda_assets",
  "delete from media.derivatives",
  "delete from media.assets",
  "delete from lineage.parentage_assertion_sources",
  "delete from lineage.parentage_assertions",
  "delete from life_history.event_sources",
  "delete from life_history.event_participants",
  "delete from life_history.events",
  "delete from life_history.residency_sources",
  "delete from life_history.residencies",
  "delete from place.places",
  "delete from place.institutions",
  "delete from panda.fact_conclusion_assertions",
  "delete from panda.fact_conclusions",
  "delete from panda.fact_assertion_sources",
  "delete from panda.fact_assertions",
  "delete from panda.external_identifier_sources",
  "delete from panda.external_identifiers",
  "delete from panda.name_sources",
  "delete from panda.names",
  "delete from panda.slugs",
  "delete from panda.pandas",
  "delete from evidence.attachments",
  "delete from evidence.sources",
];

const migrateSql = [
  `insert into evidence.sources (
     source_id,publisher,title,url,published_on,last_verified_on,language_tag,access_state,
     evidence_tier,public_summary,internal_notes,content_sha256,created_at,updated_at
   )
   select id,publisher,title,url,published_at,last_verified_at,language_tag,access_state,
     evidence_tier,public_summary,internal_notes,
     case when content_hash ~ '^[0-9a-f]{64}$' then content_hash else null end,
     created_at,updated_at
   from public.evidence_sources`,

  `insert into evidence.attachments (
     attachment_id,source_id,storage_bucket,storage_key,object_version,content_sha256,byte_size,media_type,created_at
   )
   select id,source_id,storage_bucket,storage_key,object_version,content_sha256,byte_size,media_type,created_at
   from public.evidence_attachments`,

  `insert into panda.pandas (panda_id,created_at,updated_at)
   select id,created_at,updated_at from public.pandas`,

  `insert into panda.slugs (slug_id,panda_id,slug,slug_kind,valid_from,valid_to,created_at)
   select id,panda_id,slug,slug_kind,valid_from,valid_to,created_at
   from public.panda_slugs
   union all
   select
     (substr(md5('fallback-slug:'||p.id::text),1,8)||'-'||substr(md5('fallback-slug:'||p.id::text),9,4)||'-'||
      substr(md5('fallback-slug:'||p.id::text),13,4)||'-'||substr(md5('fallback-slug:'||p.id::text),17,4)||'-'||
      substr(md5('fallback-slug:'||p.id::text),21,12))::uuid,
     p.id,p.slug,'canonical',null,null,p.created_at
   from public.pandas p
   where not exists (
     select 1 from public.panda_slugs s where s.panda_id=p.id and s.slug_kind='canonical'
   )`,

  `insert into panda.names (
     name_id,panda_id,language_tag,name_kind,value,normalized_value,is_primary,valid_from,valid_to,created_at
   )
   select id,panda_id,language_tag,name_kind,value,normalized_value,is_primary,valid_from,valid_to,created_at
   from public.panda_names`,

  `insert into panda.name_sources (name_id,source_id)
   select panda_name_id,source_id from public.panda_name_sources`,

  `insert into panda.external_identifiers (
     external_identifier_id,panda_id,system,value,normalized_value,created_at
   )
   select id,panda_id,system,value,normalized_value,created_at
   from public.panda_external_identifiers`,

  `insert into panda.external_identifier_sources (external_identifier_id,source_id)
   select external_identifier_id,source_id from public.panda_external_identifier_sources`,

  `insert into panda.fact_assertions (
     assertion_id,panda_id,field_key,value_json,certainty,lifecycle_state,last_verified_on,supersedes_assertion_id,created_at
   )
   select a.id,a.panda_id,a.field_key,a.value_json,a.certainty,
     case when exists(select 1 from public.fact_assertions newer where newer.supersedes_assertion_id=a.id)
       then 'superseded' else 'active' end,
     a.last_verified_at,a.supersedes_assertion_id,a.created_at
   from public.fact_assertions a`,

  `insert into panda.fact_assertion_sources (assertion_id,source_id,stance)
   select assertion_id,source_id,stance from public.fact_assertion_sources`,

  `insert into panda.fact_conclusions (
     conclusion_id,panda_id,field_key,value_json,status,last_verified_on,candidate_values_json,
     superseded_values_json,conclusion_version,is_current,created_at
   )
   select id,panda_id,field_key,value_json,status,last_verified_at,candidate_values_json,
     superseded_values_json,conclusion_version,is_current,created_at
   from public.public_fact_conclusions`,

  `insert into panda.fact_conclusion_assertions (conclusion_id,assertion_id)
   select conclusion_id,assertion_id from public.public_fact_conclusion_assertions`,

  `insert into place.institutions (
     institution_id,slug,name_zh,name_en,country_code,created_at,updated_at
   )
   select id,'institution-'||substr(replace(id::text,'-',''),1,12),name_zh,name_en,null,now(),now()
   from public.institutions`,

  `insert into place.places (
     place_id,institution_id,slug,place_type,name_zh,name_en,country_code,region,created_at,updated_at
   )
   select id,institution_id,'facility-'||substr(replace(id::text,'-',''),1,12),'facility',
     name_zh,name_en,country_code,null,now(),now()
   from public.facilities`,

  `with coarse(label) as (
     select coarse_location from public.panda_residencies where coarse_location is not null
     union select from_coarse_location from public.domain_events where from_coarse_location is not null
     union select to_coarse_location from public.domain_events where to_coarse_location is not null
   ), normalized as (
     select trim(label) label,md5('coarse-location:'||lower(trim(label))) digest
     from coarse where length(trim(label))>0
   )
   insert into place.places (
     place_id,institution_id,slug,place_type,name_zh,name_en,country_code,region,created_at,updated_at
   )
   select
     (substr(digest,1,8)||'-'||substr(digest,9,4)||'-'||substr(digest,13,4)||'-'||substr(digest,17,4)||'-'||substr(digest,21,12))::uuid,
     null,'coarse-'||substr(digest,1,16),'coarse_location',null,label,null,label,now(),now()
   from normalized`,

  `insert into life_history.residencies (
     residency_id,panda_id,place_id,residency_type,start_on,start_precision,end_on,end_precision,status,created_at,updated_at
   )
   select r.id,r.panda_id,
     coalesce(r.facility_id,
       case when r.coarse_location is not null then
         (substr(md5('coarse-location:'||lower(trim(r.coarse_location))),1,8)||'-'||
          substr(md5('coarse-location:'||lower(trim(r.coarse_location))),9,4)||'-'||
          substr(md5('coarse-location:'||lower(trim(r.coarse_location))),13,4)||'-'||
          substr(md5('coarse-location:'||lower(trim(r.coarse_location))),17,4)||'-'||
          substr(md5('coarse-location:'||lower(trim(r.coarse_location))),21,12))::uuid end),
     r.residency_type,r.start_date,r.start_precision,r.end_date,r.end_precision,r.status,now(),now()
   from public.panda_residencies r`,

  `insert into life_history.residency_sources (residency_id,source_id)
   select residency_id,source_id from public.residency_sources`,

  `insert into life_history.events (
     event_id,event_type,event_status,occurred_on,occurred_precision,from_place_id,to_place_id,summary,created_at,updated_at
   )
   select e.id,e.event_type,e.event_status,e.event_date,e.event_date_precision,
     coalesce(e.from_facility_id,
       case when e.from_coarse_location is not null then
         (substr(md5('coarse-location:'||lower(trim(e.from_coarse_location))),1,8)||'-'||
          substr(md5('coarse-location:'||lower(trim(e.from_coarse_location))),9,4)||'-'||
          substr(md5('coarse-location:'||lower(trim(e.from_coarse_location))),13,4)||'-'||
          substr(md5('coarse-location:'||lower(trim(e.from_coarse_location))),17,4)||'-'||
          substr(md5('coarse-location:'||lower(trim(e.from_coarse_location))),21,12))::uuid end),
     coalesce(e.to_facility_id,
       case when e.to_coarse_location is not null then
         (substr(md5('coarse-location:'||lower(trim(e.to_coarse_location))),1,8)||'-'||
          substr(md5('coarse-location:'||lower(trim(e.to_coarse_location))),9,4)||'-'||
          substr(md5('coarse-location:'||lower(trim(e.to_coarse_location))),13,4)||'-'||
          substr(md5('coarse-location:'||lower(trim(e.to_coarse_location))),17,4)||'-'||
          substr(md5('coarse-location:'||lower(trim(e.to_coarse_location))),21,12))::uuid end),
     null,now(),now()
   from public.domain_events e`,

  `insert into life_history.event_participants (event_id,panda_id,participant_role)
   select event_id,panda_id,'subject' from public.domain_event_participants`,

  `insert into life_history.event_sources (event_id,source_id)
   select event_id,source_id from public.domain_event_sources`,

  `insert into lineage.parentage_assertions (
     assertion_id,child_id,parent_id,parent_role,status,reviewed_at,created_at,updated_at
   )
   select id,child_id,parent_id,parent_role,status,reviewed_at,now(),now()
   from public.parentage_assertions`,

  `insert into lineage.parentage_assertion_sources (assertion_id,source_id)
   select assertion_id,source_id from public.parentage_assertion_sources`,

  `insert into media.assets (
     asset_id,source_id,storage_bucket,storage_key,object_version,storage_etag,content_sha256,media_type,byte_size,
     title,creator,copyright_text,license,attribution_text,rights_status,eligibility_status,taken_at,metadata,created_at,updated_at
   )
   select media.id,
     case when exists(select 1 from evidence.sources s where s.source_id=media.metadata->>'source_id')
       then media.metadata->>'source_id' else null end,
     media.storage_bucket,media.storage_path,nullif(media.metadata->>'object_version',''),nullif(media.metadata->>'storage_etag',''),
     coalesce(media.metadata->>'content_sha256',media.metadata->>'sha256'),
     coalesce(media.metadata->>'media_type',media.metadata->>'mime_type'),
     coalesce(media.metadata->>'byte_size',media.metadata->>'bytes')::bigint,
     media.title,media.photographer,media.copyright_text,media.license,
     coalesce(nullif(media.metadata->>'attribution_text',''),media.photographer),
     case when media.metadata->>'rights_status' in ('cleared','restricted','unknown') then media.metadata->>'rights_status' else 'unknown' end,
     case when media.metadata->>'eligibility_status' in ('eligible','restricted','pending') then media.metadata->>'eligibility_status' else 'pending' end,
     media.taken_at,media.metadata,media.created_at,media.updated_at
   from public.media_assets media
   where exists(select 1 from public.panda_media link where link.media_id=media.id)`,

  `insert into media.panda_assets (panda_id,asset_id,usage_role,display_order)
   select panda_id,media_id,case when is_cover then 'cover' else 'gallery' end,display_order
   from public.panda_media`,

  `insert into engagement.favorites (account_id,panda_id,favorited_at)
   select f.account_id,p.id,f.followed_at
   from engagement.follows f
   join public.pandas p on p.id::text=f.panda_id or p.slug=f.panda_id
   where f.state='active'
   on conflict(account_id,panda_id) do update
   set favorited_at=least(engagement.favorites.favorited_at,excluded.favorited_at)`,

  `with mapped as (
     select account_id,
       case when category::text='correction_retraction' then 'correction' else 'knowledge_update' end category,
       channel::text channel,enabled,version,updated_at
     from notification.preferences
     where channel::text in ('station','email')
       and category::text in ('birthday','major_activity','incorporation','correction_retraction')
   ), collapsed as (
     select account_id,category,channel,bool_and(enabled) enabled,max(version) version,max(updated_at) updated_at
     from mapped group by account_id,category,channel
   )
   insert into notification.channel_preferences (account_id,category,channel,enabled,version,updated_at)
   select account_id,category,channel,enabled,version,updated_at from collapsed`,

  `insert into game.questions (
     question_id,target_panda_id,media_asset_id,difficulty,option_panda_ids,recognition_tips,state,
     created_by,updated_by,published_at,created_at,updated_at
   )
   select q.question_id,q.panda_id,media.id,q.difficulty,q.option_panda_ids,q.recognition_tips,q.state,
     q.created_by,q.updated_by,q.published_at,q.created_at,q.updated_at
   from game.guess_questions q
   join public.media_assets media on
     (media.id::text=q.media_id or media.metadata->>'public_media_id'=q.media_id or media.metadata->>'media_id'=q.media_id)
   where exists(select 1 from public.panda_media link where link.media_id=media.id)`,

  `insert into game.attempts (attempt_id,account_id,question_id,selected_panda_id,correct,attempted_at)
   select attempt.attempt_id,attempt.account_id,q.question_id,selected.id,attempt.correct,attempt.attempted_at
   from engagement.game_attempts attempt
   join public.pandas target on target.id::text=attempt.target_panda_id or target.slug=attempt.target_panda_id
   join game.guess_questions q on q.panda_id=target.id
   join public.pandas selected on selected.id::text=attempt.selected_panda_id or selected.slug=attempt.selected_panda_id`,
];

async function countAll(client, queries) {
  const result = {};
  for (const [key, sql] of Object.entries(queries)) {
    const response = await client.query(sql);
    result[key] = Number(response.rows[0].count);
  }
  return result;
}

async function runPreflight(client) {
  const blockers = [];
  for (const check of preflightChecks) {
    const response = await client.query(check.sql);
    const count = Number(response.rows[0].count);
    if (count > 0) blockers.push({ key: check.key, count, description: check.description });
  }
  return blockers;
}

async function output(report) {
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (reportPath) await writeFile(reportPath, text, "utf8");
  process.stdout.write(text);
}

const client = new Client({
  connectionString: databaseUrl,
  ...(databaseSslCaCert === undefined
    ? {}
    : { ssl: { ca: databaseSslCaCert, rejectUnauthorized: true } }),
});
const startedAt = new Date();
const started = performance.now();

try {
  await client.connect();
  const sources = await countAll(client, sourceCounts);
  const blockers = await runPreflight(client);

  if (!apply || blockers.length > 0) {
    await output({
      version: 1,
      mode: apply ? "blocked" : "plan",
      startedAt: startedAt.toISOString(),
      durationMs: Math.round(performance.now() - started),
      sourceCounts: sources,
      blockers,
    });
    if (apply && blockers.length > 0) process.exitCode = 2;
  } else {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('zhipanda-v1-to-v2-migration'))");
    for (const sql of clearTargetSql) await client.query(sql);
    for (const sql of migrateSql) await client.query(sql);
    const targets = await countAll(client, targetCounts);
    await client.query("commit");

    await output({
      version: 1,
      mode: "applied",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
      sourceCounts: sources,
      targetCounts: targets,
      blockers: [],
    });
  }
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    // Connection/setup failures can happen before a transaction exists.
  }
  await output({
    version: 1,
    mode: "failed",
    startedAt: startedAt.toISOString(),
    durationMs: Math.round(performance.now() - started),
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
