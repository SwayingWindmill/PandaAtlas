import type { Env } from "../bindings";
import { HttpError } from "../http";
import type {
  ExternalIdentifierRecord,
  IdentityNameRecord,
  LegacySlugRecord,
  PandaDetail,
  PandaIdentityProfile,
  PandaLineageNode,
  PandaLineageRelationship,
  PandaListItem,
  PandaRow,
  PandaStatus,
  PandaGender,
  ParentageRow,
  PublicFactConclusion,
  PublicSourceSummary
} from "../types";

export interface PandaListOptions {
  page: number;
  pageSize: number;
  q: string | null;
  status: PandaStatus | null;
  gender: PandaGender | null;
  habitatId: string | null;
  featured: boolean | null;
  sort: string;
}

export interface LineageOptions {
  ancestorDepth: number;
  descendantDepth: number;
}

function normalizeIdentityTerm(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function splitSourceIds(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function parseJsonValue<T>(value: string | null, fallback: T): T {
  if (value === null) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseTags(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((tag) => String(tag)) : [];
  } catch {
    return [];
  }
}

function toListItem(row: PandaRow): PandaListItem {
  return {
    id: row.id,
    slug: row.slug,
    name_zh: row.name_zh,
    name_en: row.name_en,
    gender: row.gender,
    status: row.status,
    birth_date: row.birth_date,
    current_location: row.current_location,
    cover_image_url: resolvePublicMediaUrl(row.cover_image_url)
  };
}

function toLineageNode(row: PandaRow): PandaLineageNode {
  return {
    ...toListItem(row),
    intro: row.intro,
    tags: parseTags(row.tags_json),
    father_id: row.father_id,
    mother_id: row.mother_id
  };
}

function resolvePublicMediaUrl(storagePath: string | null): string | null {
  if (!storagePath) {
    return null;
  }
  const lowered = storagePath.toLowerCase();
  if (lowered.startsWith("http://") || lowered.startsWith("https://")) {
    return storagePath;
  }
  return null;
}

function coverImageSql(): string {
  return `
    (
      select m.storage_path
      from panda_media pm
      join media_assets m on m.id = pm.media_id
      where pm.panda_id = p.id
      order by pm.is_cover desc, pm.display_order asc, m.created_at asc, m.id asc
      limit 1
    ) as cover_image_url
  `;
}

function pandaSelectSql(): string {
  return `
    select
      p.id,
      coalesce(canonical_slug.slug, p.slug) as slug,
      p.name_zh,
      p.name_en,
      p.gender,
      p.status,
      p.birth_date,
      p.birthplace,
      p.current_location,
      p.intro,
      p.tags_json,
      p.father_id,
      p.mother_id,
      p.is_featured,
      ${coverImageSql()}
    from pandas p
    left join panda_slugs canonical_slug
      on canonical_slug.panda_id = p.id and canonical_slug.slug_kind = 'canonical'
  `;
}

function orderClause(sort: string): string {
  const mapping: Record<string, string> = {
    name_asc: "p.name_zh asc",
    name_desc: "p.name_zh desc",
    birth_date_desc: "p.birth_date desc",
    created_at_desc: "p.created_at desc"
  };
  return mapping[sort] ?? mapping.created_at_desc;
}

export async function listPandas(env: Env, options: PandaListOptions) {
  const where: string[] = ["1=1"];
  const values: unknown[] = [];

  if (options.q) {
    const qLike = `%${options.q.trim().toLowerCase()}%`;
    const normalizedQuery = normalizeIdentityTerm(options.q);
    const normalizedLike = normalizedQuery
      ? `%${normalizedQuery}%`
      : "__no_identity_match__";
    where.push(`
      (
        lower(p.name_zh) like ?
        or lower(coalesce(p.name_en, '')) like ?
        or lower(coalesce(p.tags_json, '[]')) like ?
        or exists (
          select 1 from panda_names pn
          where pn.panda_id = p.id and pn.normalized_value like ?
        )
        or exists (
          select 1 from panda_slugs ps
          where ps.panda_id = p.id and lower(ps.slug) like ?
        )
        or exists (
          select 1 from panda_external_identifiers pei
          where pei.panda_id = p.id
            and (
              pei.normalized_value like ?
              or lower(pei.system || ':' || pei.value) like ?
            )
        )
      )
    `);
    values.push(
      qLike,
      qLike,
      qLike,
      normalizedLike,
      qLike,
      normalizedLike,
      qLike
    );
  }
  if (options.status) {
    where.push("p.status = ?");
    values.push(options.status);
  }
  if (options.gender) {
    where.push("p.gender = ?");
    values.push(options.gender);
  }
  if (options.habitatId) {
    where.push("exists (select 1 from sightings s where s.panda_id = p.id and s.habitat_id = ?)");
    values.push(options.habitatId);
  }
  if (options.featured !== null) {
    where.push("p.is_featured = ?");
    values.push(options.featured ? 1 : 0);
  }

  const whereSql = where.join(" and ");
  const offset = (options.page - 1) * options.pageSize;

  const rowsResult = await env.DB.prepare(
    `${pandaSelectSql()} where ${whereSql} order by ${orderClause(options.sort)} limit ? offset ?`
  )
    .bind(...values, options.pageSize, offset)
    .all<PandaRow>();

  const totalRow = await env.DB.prepare(`select count(*) as total from pandas p where ${whereSql}`)
    .bind(...values)
    .first<{ total: number }>();

  return {
    items: (rowsResult.results ?? []).map(toListItem),
    meta: {
      page: options.page,
      page_size: options.pageSize,
      total: Number(totalRow?.total ?? 0)
    }
  };
}

async function resolvePandaRef(env: Env, pandaRef: string): Promise<{ id: string; slug: string }> {
  const rawReference = pandaRef.trim();
  if (!rawReference) {
    throw new HttpError(404, "Panda not found");
  }
  const normalizedReference = normalizeIdentityTerm(rawReference);

  const row = await env.DB.prepare(`
    select p.id, coalesce(canonical_slug.slug, p.slug) as slug
    from pandas p
    left join panda_slugs canonical_slug
      on canonical_slug.panda_id = p.id and canonical_slug.slug_kind = 'canonical'
    where p.id = ?
      or p.slug = ?
      or exists (
        select 1 from panda_slugs ps
        where ps.panda_id = p.id and ps.slug = ?
      )
      or exists (
        select 1 from panda_names pn
        where pn.panda_id = p.id and pn.normalized_value = ?
      )
      or exists (
        select 1 from panda_external_identifiers pei
        where pei.panda_id = p.id
          and (
            pei.normalized_value = ?
            or lower(pei.system || ':' || pei.value) = lower(?)
          )
      )
    order by case
      when p.id = ? then 0
      when p.slug = ? then 1
      else 2
    end
    limit 1
  `)
    .bind(
      rawReference,
      rawReference,
      rawReference,
      normalizedReference,
      normalizedReference,
      rawReference,
      rawReference,
      rawReference
    )
    .first<{ id: string; slug: string }>();

  if (!row) {
    throw new HttpError(404, "Panda not found");
  }
  return row;
}

async function loadPandaIdentity(
  env: Env,
  pandaId: string,
  canonicalSlug: string
): Promise<PandaIdentityProfile | null> {
  const namesResult = await env.DB.prepare(`
    select
      pn.value,
      pn.language_tag,
      pn.name_kind,
      pn.is_primary,
      group_concat(pns.source_id) as source_ids
    from panda_names pn
    left join panda_name_sources pns on pns.panda_name_id = pn.id
    where pn.panda_id = ?
    group by pn.id, pn.value, pn.language_tag, pn.name_kind, pn.is_primary
    order by pn.is_primary desc, pn.language_tag, pn.name_kind, pn.value
  `)
    .bind(pandaId)
    .all<{
      value: string;
      language_tag: string;
      name_kind: string;
      is_primary: number;
      source_ids: string | null;
    }>();

  const slugResult = await env.DB.prepare(`
    select ps.slug, ps.slug_kind, group_concat(pss.source_id) as source_ids
    from panda_slugs ps
    left join panda_slug_sources pss on pss.panda_slug_id = ps.id
    where ps.panda_id = ?
    group by ps.id, ps.slug, ps.slug_kind
    order by ps.slug_kind, ps.slug
  `)
    .bind(pandaId)
    .all<{ slug: string; slug_kind: string; source_ids: string | null }>();

  const identifierResult = await env.DB.prepare(`
    select
      pei.system,
      pei.value,
      group_concat(peis.source_id) as source_ids
    from panda_external_identifiers pei
    left join panda_external_identifier_sources peis
      on peis.external_identifier_id = pei.id
    where pei.panda_id = ?
    group by pei.id, pei.system, pei.value
    order by pei.system, pei.value
  `)
    .bind(pandaId)
    .all<{ system: string; value: string; source_ids: string | null }>();

  const nameRows = namesResult.results ?? [];
  const slugRows = slugResult.results ?? [];
  const identifierRows = identifierResult.results ?? [];
  if (nameRows.length === 0 && slugRows.length === 0 && identifierRows.length === 0) {
    return null;
  }

  const toNameRecord = (row: (typeof nameRows)[number]): IdentityNameRecord => ({
    value: row.value,
    language: row.language_tag,
    kind: row.name_kind,
    primary: row.is_primary === 1,
    source_ids: splitSourceIds(row.source_ids)
  });
  const aliasKinds = new Set(["alias", "historic_spelling", "historical_name", "nickname"]);

  return {
    stable_id: pandaId,
    canonical_slug:
      slugRows.find((row) => row.slug_kind === "canonical")?.slug ?? canonicalSlug,
    names: nameRows.filter((row) => !aliasKinds.has(row.name_kind)).map(toNameRecord),
    aliases: nameRows.filter((row) => aliasKinds.has(row.name_kind)).map(toNameRecord),
    legacy_slugs: slugRows
      .filter((row) => row.slug_kind === "legacy")
      .map<LegacySlugRecord>((row) => ({
        value: row.slug,
        source_ids: splitSourceIds(row.source_ids)
      })),
    external_identifiers: identifierRows.map<ExternalIdentifierRecord>((row) => ({
      system: row.system,
      value: row.value,
      source_ids: splitSourceIds(row.source_ids)
    }))
  };
}

async function loadPublicConclusions(
  env: Env,
  pandaId: string
): Promise<PublicFactConclusion[]> {
  const result = await env.DB.prepare(`
    select
      c.field_key,
      c.value_json,
      c.status,
      c.last_verified_at,
      c.candidate_values_json,
      c.superseded_values_json,
      group_concat(distinct pca.assertion_id) as assertion_ids,
      group_concat(distinct fas.source_id) as source_ids
    from public_fact_conclusions c
    left join public_fact_conclusion_assertions pca on pca.conclusion_id = c.id
    left join fact_assertion_sources fas on fas.assertion_id = pca.assertion_id
    where c.panda_id = ? and c.is_current = 1
    group by
      c.id,
      c.field_key,
      c.value_json,
      c.status,
      c.last_verified_at,
      c.candidate_values_json,
      c.superseded_values_json
    order by c.field_key
  `)
    .bind(pandaId)
    .all<{
      field_key: string;
      value_json: string | null;
      status: PublicFactConclusion["status"];
      last_verified_at: string;
      candidate_values_json: string;
      superseded_values_json: string;
      assertion_ids: string | null;
      source_ids: string | null;
    }>();

  return (result.results ?? []).map((row) => ({
    field: row.field_key,
    value: parseJsonValue<unknown>(row.value_json, null),
    status: row.status,
    last_verified_at: row.last_verified_at,
    assertion_ids: splitSourceIds(row.assertion_ids),
    source_ids: splitSourceIds(row.source_ids),
    candidate_values: parseJsonValue<unknown[]>(row.candidate_values_json, []),
    superseded_values: parseJsonValue<unknown[]>(row.superseded_values_json, [])
  }));
}

async function loadPublicSources(
  env: Env,
  sourceIds: ReadonlySet<string>
): Promise<PublicSourceSummary[]> {
  if (sourceIds.size === 0) {
    return [];
  }
  const values = [...sourceIds].sort();
  const placeholders = values.map(() => "?").join(", ");
  const result = await env.DB.prepare(`
    select
      id,
      publisher,
      title,
      url,
      published_at,
      last_verified_at,
      language_tag,
      access_state
    from evidence_sources
    where id in (${placeholders})
    order by id
  `)
    .bind(...values)
    .all<{
      id: string;
      publisher: string;
      title: string;
      url: string;
      published_at: string | null;
      last_verified_at: string;
      language_tag: string;
      access_state: string;
    }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    publisher: row.publisher,
    title: row.title,
    url: row.url,
    published_at: row.published_at,
    last_verified_at: row.last_verified_at,
    language: row.language_tag,
    access_state: row.access_state
  }));
}

function identitySourceIds(identity: PandaIdentityProfile | null): string[] {
  if (!identity) {
    return [];
  }
  return [
    ...identity.names,
    ...identity.aliases,
    ...identity.legacy_slugs,
    ...identity.external_identifiers
  ].flatMap((record) => record.source_ids);
}

export async function getPandaDetail(env: Env, pandaRef: string): Promise<PandaDetail> {
  const ref = await resolvePandaRef(env, pandaRef);
  const row = await env.DB.prepare(`${pandaSelectSql()} where p.id = ? limit 1`)
    .bind(ref.id)
    .first<PandaRow>();

  if (!row) {
    throw new HttpError(404, "Panda not found");
  }

  const habitatsResult = await env.DB.prepare(
    `
    select distinct h.id, h.name, h.province
    from sightings s
    join habitats h on h.id = s.habitat_id
    where s.panda_id = ?
    order by h.name
    `
  )
    .bind(row.id)
    .all<{ id: string; name: string; province: string | null }>();

  const mediaResult = await env.DB.prepare(
    `
    select m.id, m.storage_bucket, m.storage_path, m.title, m.photographer
    from panda_media pm
    join media_assets m on m.id = pm.media_id
    where pm.panda_id = ?
    order by pm.is_cover desc, pm.display_order asc, m.created_at asc, m.id asc
    `
  )
    .bind(row.id)
    .all<{
      id: string;
      storage_bucket: string;
      storage_path: string;
      title: string | null;
      photographer: string | null;
    }>();

  const media = (mediaResult.results ?? []).map((asset) => ({
    ...asset,
    signed_url: resolvePublicMediaUrl(asset.storage_path)
  }));
  const residenciesResult = await env.DB.prepare(
    `
    select
      r.id,
      r.facility_id,
      r.coarse_location,
      r.residency_type,
      r.start_date,
      r.start_precision,
      r.end_date,
      r.end_precision,
      r.status,
      group_concat(distinct rs.source_id) as source_ids
    from panda_residencies r
    join residency_sources rs on rs.residency_id = r.id
    where r.panda_id = ? and r.publication_status = 'published'
    group by r.id
    order by r.start_date, r.id
    `
  )
    .bind(row.id)
    .all<{
      id: string;
      facility_id: string | null;
      coarse_location: string | null;
      residency_type: "primary" | "temporary" | "transit" | "quarantine";
      start_date: string;
      start_precision: "day" | "month" | "year";
      end_date: string | null;
      end_precision: "day" | "month" | "year" | null;
      status: "confirmed" | "confirmed_country_level" | "provisional";
      source_ids: string | null;
    }>();
  const residencies = (residenciesResult.results ?? []).map((residency) => ({
    ...residency,
    source_ids: splitSourceIds(residency.source_ids)
  }));
  const currentResidency = [...residencies]
    .reverse()
    .find(
      (residency) =>
        residency.residency_type === "primary" &&
        residency.end_date === null &&
        (residency.status === "confirmed" ||
          residency.status === "confirmed_country_level")
    );

  const eventsResult = await env.DB.prepare(
    `
    select
      e.id,
      e.event_type,
      e.event_status,
      e.event_date,
      e.event_date_precision,
      e.from_facility_id,
      e.from_coarse_location,
      e.to_facility_id,
      e.to_coarse_location,
      group_concat(distinct participant.panda_id) as participants,
      group_concat(distinct es.source_id) as source_ids
    from domain_events e
    join domain_event_participants focus
      on focus.event_id = e.id and focus.panda_id = ?
    join domain_event_participants participant on participant.event_id = e.id
    join domain_event_sources es on es.event_id = e.id
    where e.publication_status = 'published'
    group by e.id
    order by e.event_date, e.id
    `
  )
    .bind(row.id)
    .all<{
      id: string;
      event_type: "transfer";
      event_status: "announced" | "completed" | "cancelled" | "disputed";
      event_date: string;
      event_date_precision: "day" | "month" | "year";
      from_facility_id: string | null;
      from_coarse_location: string | null;
      to_facility_id: string | null;
      to_coarse_location: string | null;
      participants: string | null;
      source_ids: string | null;
    }>();
  const events = (eventsResult.results ?? []).map((event) => ({
    ...event,
    participants: splitSourceIds(event.participants).sort(),
    source_ids: splitSourceIds(event.source_ids),
    changes_current_residency: event.event_status === "completed"
  }));
  const [identity, conclusions] = await Promise.all([
    loadPandaIdentity(env, row.id, ref.slug),
    loadPublicConclusions(env, row.id)
  ]);
  const sourceIds = new Set([
    ...identitySourceIds(identity),
    ...conclusions.flatMap((conclusion) => conclusion.source_ids),
    ...residencies.flatMap((residency) => residency.source_ids),
    ...events.flatMap((event) => event.source_ids)
  ]);
  const sources = await loadPublicSources(env, sourceIds);

  return {
    ...toListItem(row),
    slug: ref.slug,
    intro: row.intro,
    birthplace: row.birthplace,
    tags: parseTags(row.tags_json),
    father_id: row.father_id,
    mother_id: row.mother_id,
    habitats: habitatsResult.results ?? [],
    media,
    identity,
    conclusions,
    sources,
    current_place: currentResidency
      ? {
          facility_id: currentResidency.facility_id,
          coarse_location: currentResidency.coarse_location,
          status: currentResidency.status
        }
      : null,
    residencies,
    events
  };
}

export async function getPandaLineage(env: Env, pandaRef: string, options: LineageOptions) {
  const focus = await resolvePandaRef(env, pandaRef);
  const rowsResult = await env.DB.prepare(`${pandaSelectSql()} order by p.birth_date asc, p.name_zh asc`).all<PandaRow>();
  const parentageResult = await env.DB.prepare(`
    select pa.child_id, pa.parent_id, pa.parent_role
    from parentage_assertions pa
    where pa.status = 'confirmed'
      and pa.publication_status = 'published'
      and exists (
        select 1
        from parentage_assertion_sources pas
        where pas.assertion_id = pa.id
      )
  `).all<ParentageRow>();
  const fatherByChild = new Map<string, string>();
  const motherByChild = new Map<string, string>();
  for (const assertion of parentageResult.results ?? []) {
    const target = assertion.parent_role === "father" ? fatherByChild : motherByChild;
    target.set(assertion.child_id, assertion.parent_id);
  }
  const rows = (rowsResult.results ?? []).map((row) => ({
    ...row,
    father_id: fatherByChild.get(row.id) ?? row.father_id,
    mother_id: motherByChild.get(row.id) ?? row.mother_id
  }));
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (!byId.has(focus.id)) {
    throw new HttpError(404, "Panda not found");
  }

  const childrenByParent = new Map<string, string[]>();
  for (const row of rows) {
    for (const parentId of [row.father_id, row.mother_id]) {
      if (!parentId) {
        continue;
      }
      const children = childrenByParent.get(parentId) ?? [];
      children.push(row.id);
      childrenByParent.set(parentId, children);
    }
  }

  const ancestorIds = traverseAncestors(byId, focus.id, options.ancestorDepth);
  const descendantIds = traverseDescendants(childrenByParent, focus.id, options.descendantDepth);
  const selectedIds = new Set<string>([...ancestorIds, ...descendantIds]);
  const nodes = rows.filter((row) => selectedIds.has(row.id)).map(toLineageNode);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = buildLineageEdges(nodes, nodeIds);
  const relationships = buildLineageRelationships(nodeIds, edges);

  return {
    focus_id: focus.id,
    nodes,
    edges,
    relationships,
    meta: {
      ancestor_depth: options.ancestorDepth,
      descendant_depth: options.descendantDepth
    }
  };
}

function buildLineageRelationships(
  nodeIds: Set<string>,
  edges: Array<{ parent_id: string; child_id: string }>
): PandaLineageRelationship[] {
  const parentsByChild = new Map<string, Set<string>>();
  const childrenByParent = new Map<string, Set<string>>();
  const neighbours = new Map<string, Set<string>>();
  for (const edge of edges) {
    addToSet(parentsByChild, edge.child_id, edge.parent_id);
    addToSet(childrenByParent, edge.parent_id, edge.child_id);
    addToSet(neighbours, edge.parent_id, edge.child_id);
    addToSet(neighbours, edge.child_id, edge.parent_id);
  }

  const relationships: PandaLineageRelationship[] = [];
  for (const subjectId of [...nodeIds].sort()) {
    const parents = parentsByChild.get(subjectId) ?? new Set<string>();
    const children = childrenByParent.get(subjectId) ?? new Set<string>();
    const siblings = new Set<string>();
    const grandparents = new Set<string>();
    for (const parentId of parents) {
      for (const siblingId of childrenByParent.get(parentId) ?? []) {
        if (siblingId !== subjectId) siblings.add(siblingId);
      }
      for (const grandparentId of parentsByChild.get(parentId) ?? []) {
        grandparents.add(grandparentId);
      }
    }
    for (const [kind, relatedIds] of [
      ["parent", parents],
      ["child", children],
      ["sibling", siblings],
      ["grandparent", grandparents]
    ] as const) {
      for (const relatedId of [...relatedIds].sort()) {
        const path = shortestPath(neighbours, subjectId, relatedId);
        if (path) {
          relationships.push({ subject_id: subjectId, related_id: relatedId, kind, path });
        }
      }
    }
  }
  return relationships;
}

function addToSet(index: Map<string, Set<string>>, key: string, value: string) {
  const values = index.get(key) ?? new Set<string>();
  values.add(value);
  index.set(key, values);
}

function shortestPath(
  neighbours: Map<string, Set<string>>,
  startId: string,
  endId: string
): string[] | null {
  const queue: string[][] = [[startId]];
  const visited = new Set<string>([startId]);
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) continue;
    for (const neighbour of [...(neighbours.get(path[path.length - 1]) ?? [])].sort()) {
      if (visited.has(neighbour)) continue;
      const nextPath = [...path, neighbour];
      if (neighbour === endId) return nextPath;
      visited.add(neighbour);
      queue.push(nextPath);
    }
  }
  return null;
}

function traverseAncestors(byId: Map<string, PandaRow>, focusId: string, maxDepth: number): Set<string> {
  const selected = new Set<string>([focusId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: focusId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) {
      continue;
    }
    const row = byId.get(current.id);
    if (!row) {
      continue;
    }
    for (const parentId of [row.father_id, row.mother_id]) {
      if (parentId && byId.has(parentId) && !selected.has(parentId)) {
        selected.add(parentId);
        queue.push({ id: parentId, depth: current.depth + 1 });
      }
    }
  }
  return selected;
}

function traverseDescendants(childrenByParent: Map<string, string[]>, focusId: string, maxDepth: number): Set<string> {
  const selected = new Set<string>([focusId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: focusId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) {
      continue;
    }
    for (const childId of childrenByParent.get(current.id) ?? []) {
      if (!selected.has(childId)) {
        selected.add(childId);
        queue.push({ id: childId, depth: current.depth + 1 });
      }
    }
  }
  return selected;
}

function buildLineageEdges(nodes: PandaLineageNode[], nodeIds: Set<string>) {
  const seen = new Set<string>();
  const edges: Array<{ parent_id: string; child_id: string }> = [];
  for (const node of nodes) {
    for (const parentId of [node.father_id, node.mother_id]) {
      if (!parentId || !nodeIds.has(parentId)) {
        continue;
      }
      const key = `${parentId}:${node.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ parent_id: parentId, child_id: node.id });
      }
    }
  }
  return edges.sort((a, b) => `${a.parent_id}:${a.child_id}`.localeCompare(`${b.parent_id}:${b.child_id}`));
}
