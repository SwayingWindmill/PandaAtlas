import goldenDataset from "../../../../contracts/golden-dataset/mei-xiang-family.v1.json";

import { fanV08VisualFixtures } from "@/app/[locale]/prototype/fan-v08/visual-fixtures";

import type {
  HomeV09Collection,
  HomeV09FamilyMember,
  HomeV09FamilySpotlight,
  HomeV09Panda,
  HomeV09PlaceSpotlight,
  HomeV09Revision,
  HomeV09ViewModel,
} from "./home-v09-view-model";

type ReviewLocale = "zh" | "en";

type GoldenPanda = (typeof goldenDataset.pandas)[number];

const mediaBySlug = new Map(
  fanV08VisualFixtures.map((fixture) => [fixture.slug, fixture] as const),
);

function nameFor(panda: GoldenPanda, locale: ReviewLocale) {
  const language = locale === "zh" ? "zh-Hans" : "en";
  return panda.public.names.find((item) => item.language === language)?.value
    ?? panda.public.names[0]?.value
    ?? panda.public.canonical_slug;
}

function alternateNameFor(panda: GoldenPanda, locale: ReviewLocale) {
  const language = locale === "zh" ? "en" : "zh-Hans";
  return panda.public.names.find((item) => item.language === language)?.value ?? null;
}

function contentFor(panda: GoldenPanda, locale: ReviewLocale) {
  const wanted = locale === "zh" ? "zh-CN" : "en";
  return panda.public.content?.find((item) => item.locale === wanted)?.summary
    ?? panda.public.content?.[0]?.summary
    ?? nameFor(panda, locale);
}

function revisionFor(panda: GoldenPanda, locale: ReviewLocale) {
  const wanted = locale === "zh" ? "zh-CN" : "en";
  return panda.public.revision_summaries?.find((item) => item.locale === wanted)?.summary ?? null;
}

function factValue(pandaId: string, field: string) {
  return goldenDataset.facts.find(
    (fact) =>
      fact.publication_status === "published"
      && fact.public.subject_id === pandaId
      && fact.public.field === field,
  )?.public.value ?? null;
}

function latestFactDate(pandaId: string) {
  return goldenDataset.facts
    .filter(
      (fact) =>
        fact.publication_status === "published"
        && fact.public.subject_id === pandaId
        && fact.public.last_verified_at,
    )
    .map((fact) => fact.public.last_verified_at as string)
    .sort()
    .at(-1) ?? null;
}

function dateLabel(value: string | null, locale: ReviewLocale) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function reviewPanda(panda: GoldenPanda, locale: ReviewLocale): HomeV09Panda {
  const slug = panda.public.canonical_slug;
  const visual = mediaBySlug.get(slug);
  const birthDate = factValue(panda.id, "birth_date");

  return {
    id: panda.id,
    slug,
    name: nameFor(panda, locale),
    alternateName: alternateNameFor(panda, locale),
    href: `/${locale}/pandas/${slug}`,
    birthYear: birthDate?.slice(0, 4) ?? null,
    placeLabel: factValue(panda.id, "current_coarse_location"),
    media: visual
      ? {
          src: visual.image,
          alt: locale === "zh" ? `${visual.zh}的大熊猫照片` : `Photograph of giant panda ${visual.en}`,
          credit: visual.credit,
          rights: visual.rights,
        }
      : null,
  };
}

function visualOnlyPandas(locale: ReviewLocale): HomeV09Panda[] {
  const goldenSlugs = new Set(goldenDataset.pandas.map((panda) => panda.public.canonical_slug));

  return fanV08VisualFixtures
    .filter((fixture) => !goldenSlugs.has(fixture.slug))
    .map((fixture) => ({
      id: `review-${fixture.slug}`,
      slug: fixture.slug,
      name: locale === "zh" ? fixture.zh : fixture.en,
      alternateName: locale === "zh" ? fixture.en : fixture.zh,
      href: `/${locale}/pandas/${fixture.slug}`,
      birthYear: (locale === "zh" ? fixture.metaZh : fixture.metaEn).match(/^\d{4}/)?.[0] ?? null,
      placeLabel: (locale === "zh" ? fixture.metaZh : fixture.metaEn).split("·").at(-1)?.trim() ?? null,
      media: {
        src: fixture.image,
        alt: locale === "zh" ? `${fixture.zh}的大熊猫照片` : `Photograph of giant panda ${fixture.en}`,
        credit: fixture.credit,
        rights: fixture.rights,
      },
    }));
}

function revisions(locale: ReviewLocale): HomeV09Revision[] {
  return goldenDataset.pandas
    .flatMap((panda) => {
      const summary = revisionFor(panda, locale);
      if (!summary) return [];
      const verifiedAt = latestFactDate(panda.id);

      return [{
        id: panda.id,
        panda: reviewPanda(panda, locale),
        summary,
        verifiedAt,
        dateLabel: dateLabel(verifiedAt, locale),
      }];
    })
    .sort((left, right) =>
      (right.verifiedAt ?? "").localeCompare(left.verifiedAt ?? "")
      || left.panda.slug.localeCompare(right.panda.slug),
    );
}

function familySpotlight(locale: ReviewLocale): HomeV09FamilySpotlight {
  const meiXiang = goldenDataset.pandas.find((panda) => panda.public.canonical_slug === "mei-xiang") as GoldenPanda;
  const focus = reviewPanda(meiXiang, locale);
  const childIds = goldenDataset.parentage_assertions
    .filter(
      (assertion) =>
        assertion.publication_status === "published"
        && assertion.public.parent_id === meiXiang.id
        && assertion.public.role === "mother"
        && assertion.public.status === "confirmed",
    )
    .map((assertion) => assertion.public.child_id);

  const members: HomeV09FamilyMember[] = goldenDataset.pandas
    .filter((panda) => childIds.includes(panda.id))
    .map((panda) => ({
      ...reviewPanda(panda, locale),
      relation: "child" as const,
    }));

  return {
    focus,
    members,
    title: locale === "zh" ? "美香家族的三代公开档案" : "Three published generations around Mei Xiang",
    body: locale === "zh"
      ? "从美香、四个孩子到外孙宝力，沿确认的亲缘关系继续浏览。"
      : "Follow confirmed family links from Mei Xiang through four children to her grandson Bao Li.",
    href: `/${locale}/families?view=lineage&focus=mei-xiang`,
  };
}

function places(locale: ReviewLocale): HomeV09PlaceSpotlight[] {
  return goldenDataset.facilities
    .map((facility) => {
      const pandaIds = goldenDataset.residencies
        .filter(
          (residency) =>
            residency.publication_status === "published"
            && residency.public.facility_id === facility.id,
        )
        .map((residency) => residency.public.panda_id);

      const name = facility.public.names.find(
        (item) => item.language === (locale === "zh" ? "zh-Hans" : "en"),
      )?.value ?? facility.public.names[0]?.value ?? facility.public.canonical_slug;

      return {
        id: facility.id,
        name,
        pandaCount: new Set(pandaIds).size,
        pandaIds: [...new Set(pandaIds)],
        href: `/${locale}/map?mode=institutions&focus=${encodeURIComponent(facility.id)}`,
      };
    })
    .filter((place) => place.pandaCount > 0)
    .sort((left, right) => right.pandaCount - left.pandaCount);
}

function collections(
  locale: ReviewLocale,
  explorePandas: HomeV09Panda[],
): HomeV09Collection[] {
  const meiXiangFamilyIds = goldenDataset.pandas
    .filter((panda) => ["mei-xiang", "tai-shan", "bao-bao", "bei-bei", "xiao-qi-ji", "bao-li"].includes(panda.public.canonical_slug))
    .map((panda) => panda.id);
  const visualIds = explorePandas.filter((panda) => panda.media).map((panda) => panda.id);
  const shenshuping = goldenDataset.residencies
    .filter((residency) => residency.public.facility_id === "89f620b2-37d0-51ba-aafa-6844404a5b2c")
    .map((residency) => residency.public.panda_id);

  return [
    {
      id: "family-linked",
      title: locale === "zh" ? "美香家族" : "The Mei Xiang family",
      description: locale === "zh" ? "从确认的三代亲缘关系进入。" : "Enter through three published generations.",
      pandaIds: meiXiangFamilyIds,
      href: `/${locale}/families?view=lineage&focus=mei-xiang`,
    },
    {
      id: "with-media",
      title: locale === "zh" ? "从影像开始" : "Start with photographs",
      description: locale === "zh" ? "从有公开影像的熊猫档案开始。" : "Start with panda records that have public display media.",
      pandaIds: visualIds,
      href: `/${locale}/prototype/fan-v08/pandas?mode=photos`,
    },
    {
      id: "multi-place",
      title: locale === "zh" ? "卧龙神树坪" : "Wolong Shenshuping",
      description: locale === "zh" ? "从公开驻留记录认识同一地点的熊猫。" : "Follow pandas through published residency records at one place.",
      pandaIds: shenshuping,
      href: `/${locale}/map?mode=institutions`,
    },
    {
      id: "recently-updated",
      title: locale === "zh" ? "最近整理的档案" : "Recently reviewed records",
      description: locale === "zh" ? "从最近补充过公开信息的档案开始。" : "Start with public profiles that were updated recently.",
      pandaIds: goldenDataset.pandas
        .filter((panda) => Boolean(panda.public.revision_summaries?.length))
        .map((panda) => panda.id),
      href: `/${locale}/prototype/fan-v08/pandas?collection=recent`,
    },
  ];
}

export function buildHomeV09ReviewModel(locale: ReviewLocale): HomeV09ViewModel {
  const goldenPandas = goldenDataset.pandas.map((panda) => reviewPanda(panda, locale));
  const allExplorePandas = [...goldenPandas, ...visualOnlyPandas(locale)];
  const exploreOrder = [
    "mei-xiang",
    "fu-bao",
    "tian-tian",
    "xiao-qi-ji",
    "lun-lun",
    "tai-shan",
    "ya-lun",
    "bao-bao",
    "xi-lun",
    "bei-bei",
    "bao-li",
  ];
  const explorePandas = exploreOrder.flatMap((slug) => {
    const panda = allExplorePandas.find((item) => item.slug === slug);
    return panda ? [panda] : [];
  });
  const reviewRevisions = revisions(locale);
  const family = familySpotlight(locale);
  const reviewPlaces = places(locale);
  const xiaoQiJi = goldenDataset.pandas.find((panda) => panda.public.canonical_slug === "xiao-qi-ji") as GoldenPanda;
  const leadPanda = reviewPanda(xiaoQiJi, locale);
  const leadRevision = reviewRevisions.find((revision) => revision.panda.slug === "xiao-qi-ji");

  return {
    today: {
      lead: {
        kind: "update",
        label: locale === "zh" ? "今日 · 熊猫世界" : "Today in PandaAtlas",
        title: locale === "zh" ? "小奇迹回到中国后的公开记录" : "Xiao Qi Ji after returning to China",
        deck: contentFor(xiaoQiJi, locale),
        href: leadPanda.href,
        media: leadPanda.media,
        panda: leadPanda,
        dateLabel: leadRevision?.dateLabel ?? null,
      },
      secondary: [
        {
          kind: "update",
          label: locale === "zh" ? "最近整理" : "Recently reviewed",
          title: reviewRevisions.find((revision) => revision.panda.slug === "bao-li")?.panda.name ?? (locale === "zh" ? "宝力" : "Bao Li"),
          body: reviewRevisions.find((revision) => revision.panda.slug === "bao-li")?.summary ?? contentFor(
            goldenDataset.pandas.find((panda) => panda.public.canonical_slug === "bao-li") as GoldenPanda,
            locale,
          ),
          href: `/${locale}/pandas/bao-li`,
          dateLabel: reviewRevisions.find((revision) => revision.panda.slug === "bao-li")?.dateLabel ?? null,
        },
        {
          kind: "family",
          label: locale === "zh" ? "家族故事" : "Family story",
          title: family.title,
          body: family.body,
          href: family.href,
        },
        {
          kind: "place",
          label: locale === "zh" ? "地点聚焦" : "Featured place",
          title: reviewPlaces[0]?.name ?? (locale === "zh" ? "史密森国家动物园" : "Smithsonian's National Zoo"),
          body: locale === "zh"
            ? `连接 ${reviewPlaces[0]?.pandaCount ?? 0} 只当前公开熊猫档案。`
            : `Connected to ${reviewPlaces[0]?.pandaCount ?? 0} current public panda records.`,
          href: reviewPlaces[0]?.href ?? `/${locale}/map`,
        },
      ],
    },
    explore: {
      pandas: explorePandas,
      totalPublished: goldenDataset.dataset.core_panda_count,
    },
    revisions: reviewRevisions,
    family,
    places: reviewPlaces,
    collections: collections(locale, explorePandas),
  };
}
