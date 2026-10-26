import type { components } from "@zhipanda/api-client";

// What the latest releases changed for the pandas a fan follows. Release updates name changed resources; a
// panda changes directly, or through its family links, homes and life events, which the public lists map back
// to pandas. Removed resources are left out: there is nothing left to open.

type Schemas = components["schemas"];
export type Update = Schemas["UpdateItemDto"];

export interface Owners {
  lineage: Schemas["PublicLineageSummaryDto"][];
  residencies: Schemas["PublicResidencySummaryDto"][];
  events: Schemas["PublicLifeEventSummaryDto"][];
}

export interface PandaChange {
  pandaId: string;
  /** "资料有更新、新增经历", in a fixed order. */
  what: string;
  /** When the newest of these changes was published. */
  publishedAt: string;
}

const LABELS = [
  { kind: "panda", added: "新收录", changed: "资料有更新" },
  { kind: "life_event", added: "新增经历", changed: "经历有更新" },
  { kind: "lineage", added: "家谱有新记录", changed: "家谱有更新" },
  { kind: "residency", added: "住处有新记录", changed: "住处有更新" },
] as const;

function ownersOf(owners: Owners): Map<string, Map<string, string[]>> {
  return new Map([
    ["panda", new Map()],
    ["lineage", new Map(owners.lineage.map((link) => [link.assertionId, [link.childId, link.parentId]]))],
    ["residency", new Map(owners.residencies.map((residency) => [residency.residencyId, [residency.pandaId]]))],
    ["life_event", new Map(owners.events.map((event) => [event.eventId, event.participantIds]))],
  ]);
}

export function followedChanges(updates: Update[], followed: ReadonlySet<string>, owners: Owners): PandaChange[] {
  const byKind = ownersOf(owners);
  const found = new Map<string, { labels: Set<string>; publishedAt: string }>();
  for (const update of updates) {
    for (const target of update.targets) {
      if (target.changeType === "removed") continue;
      const label = LABELS.find((entry) => entry.kind === target.resourceKind)?.[target.changeType];
      const owned = byKind.get(target.resourceKind);
      if (!label || !owned) continue;
      const pandaIds = target.resourceKind === "panda" ? [target.resourceId] : (owned.get(target.resourceId) ?? []);
      for (const pandaId of pandaIds) {
        if (!followed.has(pandaId)) continue;
        const entry = found.get(pandaId) ?? { labels: new Set<string>(), publishedAt: update.publishedAt };
        entry.labels.add(label);
        if (update.publishedAt > entry.publishedAt) entry.publishedAt = update.publishedAt;
        found.set(pandaId, entry);
      }
    }
  }
  const order = LABELS.flatMap((entry) => [entry.added, entry.changed] as string[]);
  return [...found]
    .map(([pandaId, entry]) => ({
      pandaId,
      what: [...entry.labels].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join("、"),
      publishedAt: entry.publishedAt,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.pandaId.localeCompare(b.pandaId));
}
