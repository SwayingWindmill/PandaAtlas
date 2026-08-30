import process from "node:process";
import pg from "pg";

const { Client } = pg;
const index = process.argv.indexOf("--database-url");
const databaseUrl = index >= 0 ? process.argv[index + 1] : process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or --database-url is required");
const parsed = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("prepare-local-rehearsal may only target localhost");
}

const client = new Client({ connectionString: databaseUrl });
try {
  await client.connect();
  await client.query("begin");

  await client.query(`
    insert into public.pandas (id, slug, name_zh, name_en, gender, status)
    select
      question.panda_id,
      'rehearsal-game-target-' || substr(replace(question.panda_id::text, '-', ''), 1, 12),
      '迁移演练熊猫',
      'Migration rehearsal panda',
      'unknown',
      'unknown'
    from game.guess_questions question
    where not exists (select 1 from public.pandas panda where panda.id = question.panda_id)
    on conflict (id) do nothing
  `);

  await client.query(`
    update public.panda_slugs
    set slug = 'rehearsal-' || replace(id::text, '-', '')
    where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  `);

  await client.query(`
    update public.pandas
    set slug = 'rehearsal-' || replace(id::text, '-', '')
    where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  `);

  await client.query(`
    update public.media_assets
    set storage_path = 'rehearsal/' || id::text || '.jpg',
        metadata = metadata || jsonb_build_object(
          'content_sha256', encode(digest(id::text, 'sha256'), 'hex'),
          'byte_size', 65536,
          'media_type', 'image/jpeg',
          'rights_status', 'unknown',
          'eligibility_status', 'pending'
        )
    where exists (select 1 from public.panda_media link where link.media_id = public.media_assets.id)
  `);

  await client.query(`
    insert into public.media_assets (
      id, storage_bucket, storage_path, title, photographer, copyright_text, license, metadata
    )
    select
      '11111111-1111-4111-8111-111111111111'::uuid,
      'public-media',
      'rehearsal/guess-panda.jpg',
      'Local migration rehearsal question media',
      'Migration rehearsal fixture',
      'Migration rehearsal fixture',
      'rehearsal-only',
      jsonb_build_object(
        'public_media_id', question.media_id,
        'content_sha256', encode(digest(question.media_id, 'sha256'), 'hex'),
        'byte_size', 65536,
        'media_type', 'image/jpeg',
        'rights_status', 'unknown',
        'eligibility_status', 'pending'
      )
    from game.guess_questions question
    where not exists (
      select 1 from public.media_assets media
      where media.id::text = question.media_id
         or media.metadata->>'public_media_id' = question.media_id
         or media.metadata->>'media_id' = question.media_id
    )
    on conflict (id) do nothing
  `);

  await client.query(`
    insert into public.panda_media (panda_id, media_id, is_cover, display_order)
    select question.panda_id, '11111111-1111-4111-8111-111111111111'::uuid, false, 99
    from game.guess_questions question
    where exists (
      select 1 from public.media_assets media
      where media.id = '11111111-1111-4111-8111-111111111111'::uuid
        and media.metadata->>'public_media_id' = question.media_id
    )
    on conflict (panda_id, media_id) do nothing
  `);

  await client.query("commit");
  process.stdout.write("local migration rehearsal fixture prepared\n");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
