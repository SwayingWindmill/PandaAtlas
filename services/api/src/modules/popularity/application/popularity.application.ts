import type { PublicReadPort } from "../../publication/application/public-read.application.js";
import { type FollowCount, POPULAR_WINDOW_DAYS, type PopularPanda, rankPopular } from "./popular-pandas.js";

export interface PopularityRepository {
  /** Distinct new followers per panda since `since`. */
  followCounts(since: Date): Promise<FollowCount[]>;
}

export const POPULARITY_REPOSITORY = Symbol("POPULARITY_REPOSITORY");
export const POPULARITY_PORT = Symbol("POPULARITY_PORT");

export interface PopularPandas {
  windowDays: number;
  items: PopularPanda[];
}

export class PopularityApplication {
  public constructor(
    private readonly repository: PopularityRepository,
    private readonly publicRead: PublicReadPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Empty, not an error, when no release is published: the 找熊猫 block then stays hidden. */
  public async popular(): Promise<PopularPandas> {
    const pandas = await this.publicRead.listPandas();
    if (pandas.kind !== "ok") return { windowDays: POPULAR_WINDOW_DAYS, items: [] };
    const since = new Date(this.now().getTime() - POPULAR_WINDOW_DAYS * 86_400_000);
    const counts = await this.repository.followCounts(since);
    const published = new Map(pandas.value.items.map((panda) => [panda.pandaId, panda.canonicalSlug]));
    return { windowDays: POPULAR_WINDOW_DAYS, items: rankPopular(counts, published) };
  }
}
