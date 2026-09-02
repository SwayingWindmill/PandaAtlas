import type { PandaDetail } from "@/lib/types";

import { fanV08VisualFixtures } from "../fan-v08/visual-fixtures";

const fixtureBySlug = new Map(fanV08VisualFixtures.map((fixture) => [fixture.slug, fixture]));

export function withReviewVisual(panda: PandaDetail): PandaDetail {
  const fixture = fixtureBySlug.get(panda.slug);
  const cover = panda.cover_image_url ?? fixture?.image ?? null;
  return cover === panda.cover_image_url ? panda : { ...panda, cover_image_url: cover };
}

export function withReviewVisuals(pandas: PandaDetail[]): PandaDetail[] {
  return pandas.map(withReviewVisual);
}

export function reviewVisualCredit(slug: string): string | null {
  const fixture = fixtureBySlug.get(slug);
  return fixture ? `${fixture.credit} · ${fixture.rights}` : null;
}
