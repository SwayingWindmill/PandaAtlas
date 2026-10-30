import type { Owners, Update } from "./changes";

// 本周新鲜事: what the public releases of the last seven days brought, counted by kind. Only what a fan would
// call news is counted: a panda newly on record, a birth, a debut, a name, a move, a return home, and new
// photos. A birth or move counts when it happened lately, not when an old one is first recorded. A rolled-back release did not happen; a removed resource has nothing left to open. When nothing is
// left the digest is null and nothing is shown, as Duolingo should have said nothing instead of "no progress".

export type DigestKind = "born" | "debut" | "named" | "moved" | "home" | "added";

export interface DigestGroup {
  kind: DigestKind;
  label: string;
  /** Pandas on record now, in the order the releases name them. */
  pandaIds: string[];
}

export interface WeekDigest {
  /** "10月24日–10月30日", local days, today included. */
  range: string;
  groups: DigestGroup[];
  /** Photos added this week. Media does not map to a panda in the public lists, so only the count. */
  photos: number;
  /** The release versions this week's news came from, newest first. */
  releases: string[];
}

export const DIGEST_DAYS = 7;
/**
 * How long ago a birth or move may have happened and still be news when its record arrives. A release that
 * backfills a 2021 birth is the atlas catching up, not a cub born this week, so it is not counted.
 */
export const RECENT_DAYS = 365;

const GROUPS: { kind: DigestKind; label: string }[] = [
  { kind: "born", label: "新生" },
  { kind: "debut", label: "首次亮相" },
  { kind: "named", label: "有了名字" },
  { kind: "moved", label: "搬家" },
  { kind: "home", label: "回国" },
  { kind: "added", label: "新收录" },
];

const EVENT_KIND: Partial<Record<string, DigestKind>> = {
  birth: "born",
  public_debut: "debut",
  naming: "named",
  transfer: "moved",
  arrival: "moved",
  return: "home",
};

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthDay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** Releases published in the seven local days ending today, less the ones a later rollback undid. */
export function releasesThisWeek(updates: Update[], now: Date): Update[] {
  const since = dayStart(now);
  since.setDate(since.getDate() - (DIGEST_DAYS - 1));
  const undone = new Set(
    updates
      .filter((update) => update.updateType === "release_rolled_back")
      .flatMap((update) => update.previousReleaseId ?? []),
  );
  return updates.filter((update) => {
    const published = new Date(update.publishedAt);
    return (
      update.updateType === "release_activated" &&
      !undone.has(update.releaseId) &&
      published >= since &&
      published <= now
    );
  });
}

/**
 * The pandas a birth event is about: the participants born that day. A birth also names the mother, whose own
 * birthday is another day; when no birthday is on record the participants without one are the best guess.
 */
export function newborns(
  event: { occurredOn?: string; participantIds: string[] },
  birthDates: ReadonlyMap<string, string | null>,
): string[] {
  const day = event.occurredOn?.slice(0, 10);
  const born = event.participantIds.filter((id) => {
    const birth = birthDates.get(id);
    return Boolean(day && birth && birth.slice(0, 10) === day);
  });
  return born.length > 0 ? born : event.participantIds.filter((id) => !birthDates.get(id));
}

/** `known` is every panda on record now, with its birth date. */
export function weekDigest(
  updates: Update[],
  owners: Pick<Owners, "residencies" | "events">,
  known: ReadonlyMap<string, string | null>,
  now: Date,
): WeekDigest | null {
  const releases = releasesThisWeek(updates, now);
  const events = new Map(owners.events.map((event) => [event.eventId, event]));
  const stays = new Map(owners.residencies.map((residency) => [residency.residencyId, residency]));
  const recentSince = dayStart(now);
  recentSince.setDate(recentSince.getDate() - RECENT_DAYS);
  const recent = (date: string | undefined) => Boolean(date && date.slice(0, 10) >= localDay(recentSince));
  const found = new Map<DigestKind, Set<string>>(GROUPS.map((group) => [group.kind, new Set<string>()]));
  let photos = 0;

  const add = (kind: DigestKind, pandaIds: string[]) => {
    for (const pandaId of pandaIds) if (known.has(pandaId)) found.get(kind)!.add(pandaId);
  };

  for (const release of [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    for (const target of release.targets) {
      if (target.changeType !== "added") continue;
      switch (target.resourceKind) {
        case "panda":
          add("added", [target.resourceId]);
          break;
        case "media":
          photos += 1;
          break;
        case "life_event": {
          const event = events.get(target.resourceId);
          const kind = event && event.eventStatus === "completed" ? EVENT_KIND[event.eventType] : undefined;
          if (event && kind && recent(event.occurredOn))
            add(kind, kind === "born" ? newborns(event, known) : event.participantIds);
          break;
        }
        case "residency": {
          const stay = stays.get(target.resourceId);
          if (stay && recent(stay.startOn)) add("moved", [stay.pandaId]);
          break;
        }
        default:
          break;
      }
    }
  }

  // A panda newly on record arrives with its whole history; its birth and homes are not this week's news.
  const added = found.get("added")!;
  for (const [kind, pandaIds] of found) {
    if (kind === "added") continue;
    for (const pandaId of added) pandaIds.delete(pandaId);
  }

  const groups = GROUPS.map((group) => ({ ...group, pandaIds: [...found.get(group.kind)!] })).filter(
    (group) => group.pandaIds.length > 0,
  );
  if (groups.length === 0 && photos === 0) return null;
  const from = dayStart(now);
  from.setDate(from.getDate() - (DIGEST_DAYS - 1));
  return {
    range: `${monthDay(from)}–${monthDay(now)}`,
    groups,
    photos,
    releases: releases.map((release) => release.releaseVersion),
  };
}

/** "宝力、青宝、和花等 5 只": the first few names and the count of the rest. */
export function namesLine(names: string[], shown = 3): string {
  if (names.length <= shown) return names.join("、");
  return `${names.slice(0, shown).join("、")}等 ${names.length} 只`;
}
