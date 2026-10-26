// The 图鉴: pandas a fan has met, through the games (the API's panda book) or in person (见过).
// Pure functions over API data, so the screen stays a view and the rules are unit tested.

export type MetThrough = "daily_panda" | "guess_panda" | "seen";

export interface BookEntry {
  pandaId: string;
  /** How the fan most recently met it, and when (ISO date-time or date). */
  through: MetThrough;
  on: string;
}

export interface BookView {
  knownCount: number;
  publishedCount: number;
  byWay: Record<MetThrough, number>;
  /** Newest first, one entry per panda. */
  recent: BookEntry[];
}

interface GameEntry {
  pandaId: string;
  firstGame: "daily_panda" | "guess_panda";
  lastMetAt: string;
}

interface SeenEntry {
  pandaId: string;
  seenOn?: string | null;
  updatedAt: string;
}

export function buildBook(book: { publishedCount: number; items: GameEntry[] }, seen: SeenEntry[]): BookView {
  const latest = new Map<string, BookEntry>();
  const consider = (entry: BookEntry) => {
    const current = latest.get(entry.pandaId);
    if (!current || entry.on > current.on) latest.set(entry.pandaId, entry);
  };
  for (const item of book.items) consider({ pandaId: item.pandaId, through: item.firstGame, on: item.lastMetAt });
  for (const item of seen) consider({ pandaId: item.pandaId, through: "seen", on: item.seenOn ?? item.updatedAt });

  const byWay: Record<MetThrough, number> = { daily_panda: 0, guess_panda: 0, seen: 0 };
  for (const item of book.items) byWay[item.firstGame] += 1;
  byWay.seen = new Set(seen.map((item) => item.pandaId)).size;

  return {
    knownCount: latest.size,
    publishedCount: book.publishedCount,
    byWay,
    recent: [...latest.values()].sort((a, b) => b.on.localeCompare(a.on)),
  };
}

const WAY_LABEL: Record<MetThrough, string> = { daily_panda: "每日一猫", guess_panda: "猜熊猫", seen: "去现场见过" };

/** "7/20 每日一猫" for a recent tile. */
export function entryCaption(entry: BookEntry): string {
  const [, month, day] = entry.on.slice(0, 10).split("-");
  return `${Number(month)}/${Number(day)} ${WAY_LABEL[entry.through]}`;
}

export function wayLabel(way: MetThrough): string {
  return WAY_LABEL[way];
}

/** Share of the collection, rounded down but never shown as 0% once something is known. */
export function progressPercent(view: Pick<BookView, "knownCount" | "publishedCount">): number {
  if (view.publishedCount === 0 || view.knownCount === 0) return 0;
  return Math.max(1, Math.floor((view.knownCount / view.publishedCount) * 100));
}
