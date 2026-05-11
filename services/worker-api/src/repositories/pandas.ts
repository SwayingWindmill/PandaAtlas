import type { Env } from "../bindings";
import { HttpError } from "../http";
import type {
  PandaDetail,
  PandaLineageNode,
  PandaListItem,
  PandaRow,
  PandaStatus,
  PandaGender
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
      p.slug,
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
    where.push("(lower(p.name_zh) like ? or lower(coalesce(p.name_en, '')) like ? or lower(coalesce(p.tags_json, '[]')) like ?)");
    values.push(qLike, qLike, qLike);
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
  const normalized = pandaRef.trim();
  if (!normalized) {
    throw new HttpError(404, "Panda not found");
  }

  const row = await env.DB.prepare("select id, slug from pandas where id = ? or slug = ? limit 1")
    .bind(normalized, normalized)
    .first<{ id: string; slug: string }>();

  if (!row) {
    throw new HttpError(404, "Panda not found");
  }
  return row;
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

  return {
    ...toListItem(row),
    intro: row.intro,
    birthplace: row.birthplace,
    tags: parseTags(row.tags_json),
    father_id: row.father_id,
    mother_id: row.mother_id,
    habitats: habitatsResult.results ?? [],
    media
  };
}

export async function getPandaLineage(env: Env, pandaRef: string, options: LineageOptions) {
  const focus = await resolvePandaRef(env, pandaRef);
  const rowsResult = await env.DB.prepare(`${pandaSelectSql()} order by p.birth_date asc, p.name_zh asc`).all<PandaRow>();
  const rows = rowsResult.results ?? [];
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

  return {
    focus_id: focus.id,
    nodes,
    edges,
    meta: {
      ancestor_depth: options.ancestorDepth,
      descendant_depth: options.descendantDepth
    }
  };
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
