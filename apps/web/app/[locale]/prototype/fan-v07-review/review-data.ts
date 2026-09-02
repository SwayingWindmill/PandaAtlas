import type { PandaDetail } from "@/lib/types";

import { fanV08VisualFixtures } from "../fan-v08/visual-fixtures";

export type ReviewLocale = "zh" | "en";

const fixtureBySlug = new Map(fanV08VisualFixtures.map((fixture) => [fixture.slug, fixture]));

export function reviewName(panda: PandaDetail, locale: ReviewLocale): string {
  if (locale === "zh") return panda.name_zh;
  return panda.name_en ?? panda.name_zh;
}

export function reviewAltName(panda: PandaDetail, locale: ReviewLocale): string | null {
  if (locale === "zh") return panda.name_en;
  return panda.name_en ? panda.name_zh : null;
}

export function reviewImage(panda: PandaDetail): string | null {
  return panda.cover_image_url ?? fixtureBySlug.get(panda.slug)?.image ?? null;
}

export function reviewImageAlt(panda: PandaDetail, locale: ReviewLocale): string {
  return locale === "zh"
    ? `${reviewName(panda, locale)}的大熊猫照片`
    : `Giant panda ${reviewName(panda, locale)}`;
}

export function reviewMeta(panda: PandaDetail, locale: ReviewLocale): string {
  const sex = panda.gender === "female"
    ? locale === "zh" ? "雌性" : "Female"
    : panda.gender === "male"
      ? locale === "zh" ? "雄性" : "Male"
      : locale === "zh" ? "性别未知" : "Sex unknown";
  const status = panda.status === "alive"
    ? locale === "zh" ? "存活" : "Alive"
    : panda.status === "deceased"
      ? locale === "zh" ? "已去世" : "Deceased"
      : locale === "zh" ? "状态未知" : "Status unknown";
  return [sex, panda.birth_date?.slice(0, 4), panda.current_place?.coarse_location ?? panda.current_location, status]
    .filter(Boolean)
    .join(" · ");
}

export function fixtureCredit(slug: string): string | null {
  const fixture = fixtureBySlug.get(slug);
  return fixture ? `${fixture.credit} · ${fixture.rights}` : null;
}

export function pickPhotographedPandas(pandas: PandaDetail[], count: number): PandaDetail[] {
  const withFixture = pandas.filter((panda) => fixtureBySlug.has(panda.slug));
  const withPublishedCover = pandas.filter((panda) => Boolean(panda.cover_image_url) && !fixtureBySlug.has(panda.slug));
  const withoutPhoto = pandas.filter((panda) => !fixtureBySlug.has(panda.slug) && !panda.cover_image_url);
  return [...withFixture, ...withPublishedCover, ...withoutPhoto].slice(0, count);
}
