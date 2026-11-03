// The 图鉴 as a personal life list: every panda a fan has met, in the two ways the app knows —
// 见过 (marked in person) and 认出 (picked out in 每日一猫 or 猜熊猫) — plus the places they have
// been (去过). Completion is only ever counted against finite, real groups: the pandas living at
// one base, or one family. There is no bar against the whole catalog, which no fan can fill.
// Pure functions over API data, so the screen stays a view and the rules are unit tested.

export type Game = "daily_panda" | "guess_panda";

export interface GameEntry {
  pandaId: string;
  firstGame: Game;
  firstMetAt: string;
  timesMet: number;
}

export interface SeenEntry {
  pandaId: string;
  seenOn?: string | null;
  placeId?: string | null;
  firstSeenAt: string;
}

export interface LifeEntry {
  pandaId: string;
  /** Its place in the list, in the order the fan first met each panda: No.1 is the first. */
  number: number;
  /** The first time the fan met it either way (a date or an ISO date-time). */
  firstOn: string;
  seen: { on: string; placeId: string | null } | null;
  recognized: { game: Game; on: string; times: number } | null;
}

export interface LifeList {
  /** Newest first. */
  entries: LifeEntry[];
  seenCount: number;
  recognizedCount: number;
}

const day = (value: string) => value.slice(0, 10);

export function buildLifeList(games: GameEntry[], seen: SeenEntry[]): LifeList {
  const byPanda = new Map<string, Omit<LifeEntry, "number" | "firstOn">>();
  const entry = (pandaId: string) => {
    const current = byPanda.get(pandaId) ?? { pandaId, seen: null, recognized: null };
    byPanda.set(pandaId, current);
    return current;
  };
  for (const item of games) {
    entry(item.pandaId).recognized = { game: item.firstGame, on: item.firstMetAt, times: Math.max(1, item.timesMet) };
  }
  for (const item of seen) {
    entry(item.pandaId).seen = { on: item.seenOn ?? item.firstSeenAt, placeId: item.placeId ?? null };
  }

  const dated = [...byPanda.values()].map((item) => {
    const days = [item.seen?.on, item.recognized?.on].filter((value): value is string => Boolean(value)).map(day);
    return { ...item, firstOn: days.sort()[0]! };
  });
  // Oldest first to number them, ties broken by id so the numbers never shuffle between loads.
  dated.sort((a, b) => a.firstOn.localeCompare(b.firstOn) || a.pandaId.localeCompare(b.pandaId));
  const entries = dated.map((item, index) => ({ ...item, number: index + 1 })).reverse();

  return {
    entries,
    seenCount: entries.filter((item) => item.seen).length,
    recognizedCount: entries.filter((item) => item.recognized).length,
  };
}

/** "8月14日" for a date or date-time. */
export function monthDay(value: string): string {
  const [, month, date] = day(value).split("-");
  return `${Number(month)}月${Number(date)}日`;
}

const GAME_LABEL: Record<Game, string> = { daily_panda: "每日一猫", guess_panda: "猜熊猫" };

/**
 * The line under a panda's name: each way the fan met it, oldest first, with the day and, for a
 * 见过, the place. "6月1日每日一猫认出，遇到 3 次 · 8月14日在史密森国家动物园见过"
 */
export function entryDetail(entry: LifeEntry, placeName: (placeId: string) => string | null): string {
  const parts: { on: string; text: string }[] = [];
  if (entry.seen) {
    const where = entry.seen.placeId ? placeName(entry.seen.placeId) : null;
    parts.push({ on: day(entry.seen.on), text: `${monthDay(entry.seen.on)}${where ? `在${where}` : ""}见过` });
  }
  if (entry.recognized) {
    const { game, on, times } = entry.recognized;
    parts.push({ on: day(on), text: `${monthDay(on)}${GAME_LABEL[game]}认出${times > 1 ? `，遇到 ${times} 次` : ""}` });
  }
  return parts
    .sort((a, b) => a.on.localeCompare(b.on))
    .map((part) => part.text)
    .join(" · ");
}

export type Filter = "all" | "seen" | "recognized";

export function filterEntries(entries: LifeEntry[], filter: Filter): LifeEntry[] {
  if (filter === "all") return entries;
  return entries.filter((entry) => (filter === "seen" ? entry.seen : entry.recognized));
}

export interface Group {
  key: string;
  title: string;
  /** Where the row opens: a place slug, or the slug of a panda whose family page it is. */
  slug: string | null;
  members: string[];
  known: number;
  /** The last day the fan went there, for a base. */
  visitedOn: string | null;
}

interface PlaceLike {
  slug: string;
  placeType: string;
  name: string | null;
}

/**
 * One group per base that has pandas living there now, and one per place the fan has been to,
 * even if no panda lives there any more. Bases the fan knows a panda at or has been to come first.
 */
export function baseGroups(
  residents: { id: string; placeId: string | null }[],
  places: Map<string, PlaceLike>,
  known: Set<string>,
  visits: { placeId: string; visitedOn: string }[],
): Group[] {
  const members = new Map<string, string[]>();
  for (const panda of residents) {
    const place = panda.placeId ? places.get(panda.placeId) : undefined;
    if (!panda.placeId || !place || place.placeType !== "facility") continue;
    members.set(panda.placeId, [...(members.get(panda.placeId) ?? []), panda.id]);
  }
  const lastVisit = new Map<string, string>();
  for (const visit of visits) {
    if ((lastVisit.get(visit.placeId) ?? "") < visit.visitedOn) lastVisit.set(visit.placeId, visit.visitedOn);
  }
  const ids = new Set([...members.keys(), ...lastVisit.keys()]);
  const groups = [...ids].flatMap((placeId): Group[] => {
    const place = places.get(placeId);
    if (!place?.name) return [];
    const pandas = members.get(placeId) ?? [];
    return [
      {
        key: placeId,
        title: place.name,
        slug: place.slug,
        members: pandas,
        known: pandas.filter((id) => known.has(id)).length,
        visitedOn: lastVisit.get(placeId) ?? null,
      },
    ];
  });
  return sortGroups(groups);
}

/**
 * Families from the lineage: each connected set of parents and children is one family, named by
 * its eldest generation ("添添和美香家"), opening on the family page of its first elder.
 */
export function familyGroups(
  links: { childId: string; parentId: string }[],
  pandas: Map<string, { name: string; slug: string }>,
  known: Set<string>,
): Group[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const usable = links.filter((link) => pandas.has(link.childId) && pandas.has(link.parentId));
  for (const link of usable) union(link.childId, link.parentId);

  const children = new Set(usable.map((link) => link.childId));
  const components = new Map<string, string[]>();
  for (const id of parent.keys()) components.set(find(id), [...(components.get(find(id)) ?? []), id]);

  const byName = (a: string, b: string) => pandas.get(a)!.name.localeCompare(pandas.get(b)!.name, "zh-CN");
  const groups = [...components.values()].map((ids): Group => {
    const members = [...ids].sort(byName);
    const elders = members.filter((id) => !children.has(id));
    const names = elders.slice(0, 2).map((id) => pandas.get(id)!.name);
    return {
      key: elders[0] ?? members[0]!,
      title: `${names.join("和")}${elders.length > 2 ? "等" : ""}家`,
      slug: pandas.get(elders[0] ?? members[0]!)!.slug,
      members,
      known: members.filter((id) => known.has(id)).length,
      visitedOn: null,
    };
  });
  return sortGroups(groups);
}

function sortGroups(groups: Group[]): Group[] {
  const started = (group: Group) => Number(group.known > 0 || group.visitedOn !== null);
  return groups.sort(
    (a, b) =>
      started(b) - started(a) ||
      b.known / Math.max(1, b.members.length) - a.known / Math.max(1, a.members.length) ||
      b.members.length - a.members.length ||
      a.title.localeCompare(b.title, "zh-CN"),
  );
}

/** "认识 2/3 只", or "全部认识" when every panda in a group is known. */
export function groupProgress(group: Pick<Group, "known" | "members">): string {
  if (group.members.length === 0) return "现在没有熊猫住在这里";
  if (group.known === group.members.length) return `${group.members.length} 只全部认识`;
  return `认识 ${group.known}/${group.members.length} 只`;
}
