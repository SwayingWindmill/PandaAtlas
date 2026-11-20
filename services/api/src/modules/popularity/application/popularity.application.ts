import type { EngagementFollowCountPort } from "../../engagement/application/engagement-follow-count.port.js";
import type { PublicReadPort } from "../../public-read/application/public-read.application.js";
import { POPULAR_WINDOW_DAYS, type PopularPanda, rankPopular } from "./popular-pandas.js";

export interface PopularPandas {
  windowDays: number;
  items: PopularPanda[];
}

export class PopularityApplication {
  public constructor(
    private readonly followCounts: EngagementFollowCountPort,
    private readonly publicRead: PublicReadPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Empty, not an error, when no release is published: the 找熊猫 block then stays hidden. */
  public async popular(): Promise<PopularPandas> {
    const pandas = await this.publicRead.listPandas();
    if (pandas.kind !== "ok") return { windowDays: POPULAR_WINDOW_DAYS, items: [] };
    const since = new Date(this.now().getTime() - POPULAR_WINDOW_DAYS * 86_400_000);
    const counts = await this.followCounts.followCounts(since);
    const published = new Map(pandas.value.items.map((panda) => [panda.pandaId, panda.canonicalSlug]));
    return { windowDays: POPULAR_WINDOW_DAYS, items: rankPopular(counts, published) };
  }
}
