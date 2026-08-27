import { sql } from "kysely";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import { sha256Content } from "../../../platform/integrity/content-digest.js";
import type {
  PandaPublicationPort,
  PandaPublicationSource,
  PublicPandaFact,
  PublicPandaName,
} from "../application/panda-publication.application.js";

interface PandaPublicationRow {
  panda_id: string;
  canonical_slug: string;
  legacy_slugs: string[];
  names: PublicPandaName[];
  facts: PublicPandaFact[];
  evidence_source_ids: string[];
  source_revision: Date;
  source_version: string;
}

export class PostgresPandaPublicationQuery implements PandaPublicationPort {
  public async snapshot(transaction: DatabaseTransaction): Promise<PandaPublicationSource[]> {
    const result = await sql<PandaPublicationRow>`
      select
        p.panda_id,
        canonical.slug as canonical_slug,
        coalesce((
          select array_agg(s.slug order by s.slug)
          from panda.slugs s
          where s.panda_id = p.panda_id and s.slug_kind = 'legacy'
        ), '{}'::text[]) as legacy_slugs,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'languageTag', n.language_tag,
              'nameKind', n.name_kind,
              'value', n.value,
              'isPrimary', n.is_primary
            ) order by n.is_primary desc, n.language_tag, n.name_kind, n.value
          )
          from panda.names n
          where n.panda_id = p.panda_id
        ), '[]'::jsonb) as names,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'fieldKey', c.field_key,
              'value', c.value_json,
              'status', c.status,
              'lastVerifiedOn', c.last_verified_on,
              'conclusionVersion', c.conclusion_version
            ) order by c.field_key
          )
          from panda.fact_conclusions c
          where c.panda_id = p.panda_id
            and c.is_current
            and c.status <> 'superseded'
        ), '[]'::jsonb) as facts,
        coalesce((
          select array_agg(distinct evidence_source_id order by evidence_source_id)
          from (
            select ns.source_id as evidence_source_id
            from panda.names n
            join panda.name_sources ns on ns.name_id = n.name_id
            where n.panda_id = p.panda_id
            union
            select fas.source_id as evidence_source_id
            from panda.fact_conclusions c
            join panda.fact_conclusion_assertions ca on ca.conclusion_id = c.conclusion_id
            join panda.fact_assertion_sources fas on fas.assertion_id = ca.assertion_id
            where c.panda_id = p.panda_id and c.is_current and c.status <> 'superseded'
          ) evidence_refs
        ), '{}'::text[]) as evidence_source_ids,
        greatest(
          p.updated_at,
          coalesce((select max(s.created_at) from panda.slugs s where s.panda_id = p.panda_id), p.updated_at),
          coalesce((select max(n.created_at) from panda.names n where n.panda_id = p.panda_id), p.updated_at),
          coalesce((select max(c.created_at) from panda.fact_conclusions c where c.panda_id = p.panda_id and c.is_current), p.updated_at)
        ) as source_revision,
        coalesce((
          select max(c.conclusion_version)::text
          from panda.fact_conclusions c
          where c.panda_id = p.panda_id and c.is_current
        ), '1') as source_version
      from panda.pandas p
      join lateral (
        select s.slug
        from panda.slugs s
        where s.panda_id = p.panda_id
          and s.slug_kind = 'canonical'
          and s.valid_to is null
        limit 1
      ) canonical on true
      order by p.panda_id
    `.execute(transaction);

    return result.rows.map((row) => {
      const projection = {
        pandaId: row.panda_id,
        canonicalSlug: row.canonical_slug,
        legacySlugs: row.legacy_slugs,
        names: row.names,
        facts: row.facts,
        evidenceSourceIds: row.evidence_source_ids,
      };
      return {
        ...projection,
        sourceRevision: row.source_revision.toISOString(),
        sourceVersion: row.source_version,
        sourceSha256: sha256Content(projection),
      };
    });
  }
}
