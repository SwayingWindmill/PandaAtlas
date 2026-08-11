import type {
  PublicAtlasDataset,
  PublicContentEnvelope,
} from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";
import type { PandaDetail, PublicEntityName, PublicFacilitySummary } from "@/lib/types";

export interface EditorialHomeProfile {
  id: string;
  slug: string;
  name: string;
  alternateName: string | null;
  summary: string;
  birthLabel: string;
  genderLabel: string;
  currentPlace: string;
  media: EditorialHomeHeroMedia | null;
  href: string;
}

export interface EditorialHomeExploration {
  id: "relationships" | "places";
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLinks: Array<{ label: string; href: string }>;
  familyPreview?: Array<{ name: string; alternateName: string | null; href: string }>;
}

export interface EditorialHomeRevision {
  id: string;
  pandaName: string;
  alternateName: string | null;
  summary: string;
  verifiedLabel: string;
  href: string;
}

export interface EditorialHomeMethodItem {
  title: string;
  body: string;
}

export interface EditorialHomeHeroMedia {
  src: string;
  srcSet: string | undefined;
  width: number | null;
  height: number | null;
  alt: string;
  credit: string | null;
  rights: string | null;
  sourceUrl: string | null;
  profileHref: string;
  profileLabel: string;
}

export interface EditorialHomeViewModel {
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    searchLabel: string;
    inputLabel: string;
    placeholder: string;
    searchAction: string;
    searchButton: string;
    atlasLabel: string;
    atlasHref: string;
    quickLinks: Array<{ label: string; href: string }>;
    media: EditorialHomeHeroMedia | null;
    noMediaLabel: string;
    noMediaTitle: string;
    noMediaBody: string;
  };
  profiles: {
    eyebrow: string;
    title: string;
    description: string;
    selectionDisclosure: string;
    items: EditorialHomeProfile[];
  };
  explorations: {
    eyebrow: string;
    title: string;
    description: string;
    items: EditorialHomeExploration[];
  };
  revisions: {
    eyebrow: string;
    title: string;
    description: string;
    empty: string;
    items: EditorialHomeRevision[];
  };
  method: {
    eyebrow: string;
    title: string;
    description: string;
    items: readonly EditorialHomeMethodItem[];
  };
}

const editorialSelection = ["bao-li", "qing-bao", "lun-lun", "shin-shin"] as const;
const quickSearchSelection = ["mei-xiang", "bao-li", "xiao-qi-ji"] as const;
const familyPreviewSelection = ["mei-xiang", "bao-bao", "bao-li"] as const;

const copy = {
  zh: {
    hero: {
      eyebrow: "吱熊猫 ZhiPanda",
      title: "认识你收藏的每一只熊猫",
      description: "搜索名字，查看它的图片、家庭关系、生活地点与公开资料。",
      searchLabel: "搜索熊猫",
      inputLabel: "输入熊猫名字",
      placeholder: "例如：美香、花花、福宝",
      searchButton: "找熊猫",
      atlasLabel: "浏览全部熊猫",
      noMediaLabel: "首页熊猫主图",
      noMediaTitle: "今天从一只熊猫开始",
      noMediaBody: "当前发布没有可用于首页的授权图片。搜索、家庭关系、地点和来源仍然可以正常使用。",
    },
    profiles: {
      eyebrow: "精选熊猫",
      title: "今天认识哪只熊猫？",
      description: "从四只有公开图片和清晰资料的熊猫开始，再沿家庭与地点继续探索。",
      selectionDisclosure: "精选用于帮助开始探索，不代表访问量或受欢迎程度排名。",
    },
    explorations: {
      eyebrow: "继续探索",
      title: "从家庭和地点认识更多熊猫",
      description: "一只熊猫的资料，会自然连接到它的家人和生活过的地方。",
      relationships: {
        eyebrow: "看看它们的家庭",
        title: "从美香到宝宝，再到宝力",
        body: "沿三代母系关系继续查看父母、子女、兄弟姐妹与来源。",
        primaryLabel: "查看完整家庭关系",
        secondary: "认识宝力",
      },
      places: {
        eyebrow: "看看它们在哪里",
        title: "从动物园与保护基地寻找熊猫",
        body: "查看当前和历史驻留地点；公开记录精度不足时，不推测精确坐标。",
        primaryLabel: "打开熊猫地图",
        institution: "史密森国家动物园",
        place: "卧龙神树坪基地",
      },
    },
    revisions: {
      eyebrow: "最近更新",
      title: "刚刚补充的熊猫资料",
      description: "直接查看每只熊猫新增或修订了什么。",
      empty: "当前没有可展示的最近更新。",
      verified: "最后核实",
    },
    method: {
      eyebrow: "资料原则",
      title: "清楚、可靠，也诚实面对未知",
      description: "每条关键资料都保留来源；不确定关系会明确标记，没有授权图片时不会用其他熊猫替代。",
      items: [
        {
          title: "资料注明来源",
          body: "关键事实可以继续查看公开来源与最后核实时间。",
        },
        {
          title: "不确定关系明确标记",
          body: "确认、暂定、争议与已取代状态不会混写成确定事实。",
        },
        {
          title: "不使用替代照片",
          body: "没有该熊猫的授权图片时，页面会诚实显示无图状态。",
        },
      ],
    },
    labels: {
      unknownPlace: "现居地点未公开",
      countryChina: "中国（国家级记录）",
      male: "雄性",
      female: "雌性",
      unknownGender: "性别未公开",
      unknownBirth: "出生日期未公开",
    },
  },
  en: {
    hero: {
      eyebrow: "ZhiPanda",
      title: "Discover the pandas you care about",
      description: "Search a name, then explore its images, family, places, and public profile.",
      searchLabel: "Search pandas",
      inputLabel: "Enter a panda name",
      placeholder: "For example: Mei Xiang, Bao Li, Fu Bao",
      searchButton: "Find a panda",
      atlasLabel: "Browse all pandas",
      noMediaLabel: "Homepage panda image",
      noMediaTitle: "Start with one panda today",
      noMediaBody: "This release has no licensed image available for the Home. Search, family relationships, places, and sources remain fully usable.",
    },
    profiles: {
      eyebrow: "Featured pandas",
      title: "Which panda will you meet today?",
      description: "Start with four pandas that have public images and clear profiles, then continue through family and place.",
      selectionDisclosure: "These selections help people start exploring; they are not popularity or traffic rankings.",
    },
    explorations: {
      eyebrow: "Keep exploring",
      title: "Discover more through family and place",
      description: "One panda naturally connects to its relatives and the places where it has lived.",
      relationships: {
        eyebrow: "Meet their family",
        title: "From Mei Xiang to Bao Bao to Bao Li",
        body: "Follow three maternal generations, then continue to parents, children, siblings, and sources.",
        primaryLabel: "See the full family",
        secondary: "Meet Bao Li",
      },
      places: {
        eyebrow: "See where they live",
        title: "Find pandas through zoos and conservation bases",
        body: "Explore current and historical residencies without inferring precise coordinates from coarse public records.",
        primaryLabel: "Open the panda map",
        institution: "Smithsonian National Zoo",
        place: "Wolong Shenshuping Base",
      },
    },
    revisions: {
      eyebrow: "Recent updates",
      title: "Newly added panda information",
      description: "See what was added or revised for each panda.",
      empty: "There are no recent localized updates to show.",
      verified: "Last verified",
    },
    method: {
      eyebrow: "Information principles",
      title: "Clear, reliable, and honest about uncertainty",
      description: "Key information keeps its sources, uncertain relationships are labelled, and missing licensed images are never replaced with another panda.",
      items: [
        {
          title: "Information includes sources",
          body: "Key facts link to public sources and verification dates.",
        },
        {
          title: "Uncertainty is labelled",
          body: "Confirmed, tentative, disputed, and superseded states remain distinct.",
        },
        {
          title: "No substitute photos",
          body: "When no licensed image exists, the profile shows an honest no-image state.",
        },
      ],
    },
    labels: {
      unknownPlace: "Current place not published",
      countryChina: "China (country-level record)",
      male: "Male",
      female: "Female",
      unknownGender: "Sex not published",
      unknownBirth: "Birth date not published",
    },
  },
} as const;

function localizedText(
  values: Array<{ locale: string; summary: string }>,
  locale: PublicLocale,
): string | null {
  const language = locale === "zh" ? "zh-CN" : "en";
  return values.find((item) => item.locale === language)?.summary ?? null;
}

function localizedEntityName(names: PublicEntityName[], locale: PublicLocale): string | null {
  const language = locale === "zh" ? "zh-Hans" : "en";
  return names.find((name) => name.language === language)?.value
    ?? names.find((name) => name.language === "en")?.value
    ?? names[0]?.value
    ?? null;
}

function profileName(panda: PandaDetail, locale: PublicLocale): { display: string; alternate: string | null } {
  const display = locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
  const alternate = locale === "zh" ? panda.name_en : panda.name_zh;
  return { display, alternate: alternate && alternate !== display ? alternate : null };
}

function latestVerifiedAt(panda: PandaDetail): string | null {
  return [
    ...panda.sources.map((source) => source.last_verified_at),
    ...panda.conclusions.map((conclusion) => conclusion.last_verified_at),
    panda.current_place?.last_verified_at ?? null,
  ].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function formatDate(value: string | null, locale: PublicLocale): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function birthLabel(panda: PandaDetail, locale: PublicLocale): string {
  if (!panda.birth_date) return copy[locale].labels.unknownBirth;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${panda.birth_date}T00:00:00Z`));
}

function genderLabel(panda: PandaDetail, locale: PublicLocale): string {
  const labels = copy[locale].labels;
  if (panda.gender === "male") return labels.male;
  if (panda.gender === "female") return labels.female;
  return labels.unknownGender;
}

function facilityName(
  facility: PublicFacilitySummary | undefined,
  locale: PublicLocale,
): string | null {
  return facility ? localizedEntityName(facility.names, locale) : null;
}

function currentPlace(
  panda: PandaDetail,
  facilities: Map<string, PublicFacilitySummary>,
  locale: PublicLocale,
): string {
  const t = copy[locale].labels;
  const facility = panda.current_place?.facility_id
    ? facilityName(facilities.get(panda.current_place.facility_id), locale)
    : null;
  if (facility) return facility;
  const coarse = panda.current_place?.coarse_location ?? panda.current_location;
  if (coarse === "China") return t.countryChina;
  return coarse ?? t.unknownPlace;
}

function httpsUrl(value: string | null | undefined): string | null {
  if (!value || !URL.canParse(value)) return null;
  return new URL(value).protocol === "https:" ? value : null;
}

function buildHeroMedia(panda: PandaDetail, locale: PublicLocale): EditorialHomeHeroMedia | null {
  if (panda.media_release?.license_state !== "licensed") return null;
  const item = panda.media.find((media) => media.status === "available");
  const src = httpsUrl(item?.url) ?? httpsUrl(item?.signed_url);
  if (!item || !src) return null;

  const name = profileName(panda, locale);
  const derivatives = item.derivatives
    .flatMap((derivative) => {
      const url = httpsUrl(derivative.url);
      return url ? [`${url} ${derivative.width}w`] : [];
    })
    .join(", ");

  return {
    src,
    srcSet: derivatives || undefined,
    width: item.width,
    height: item.height,
    alt: locale === "zh"
      ? item.alt_zh ?? item.alt_en ?? panda.name_zh
      : item.alt_en ?? item.alt_zh ?? panda.name_en ?? panda.name_zh,
    credit: item.credit ?? item.photographer ?? null,
    rights: item.rights,
    sourceUrl: httpsUrl(item.source_url),
    profileHref: `/${locale}/pandas/${panda.slug}`,
    profileLabel: locale === "zh" ? `认识${name.display}` : `Meet ${name.display}`,
  };
}

export function buildEditorialHomeViewModel(
  envelope: PublicContentEnvelope<PublicAtlasDataset>,
  locale: PublicLocale,
): EditorialHomeViewModel {
  const t = copy[locale];
  const pandasBySlug = new Map(envelope.data.pandas.map((panda) => [panda.slug, panda]));
  const facilitiesById = new Map(envelope.data.facilities.map((facility) => [facility.id, facility]));
  const heroCandidates = [
    ...editorialSelection.flatMap((slug) => {
      const panda = pandasBySlug.get(slug);
      return panda ? [panda] : [];
    }),
    ...envelope.data.pandas.filter((panda) => !editorialSelection.includes(panda.slug as typeof editorialSelection[number])),
  ];
  const heroMedia = heroCandidates
    .map((panda) => buildHeroMedia(panda, locale))
    .find((media): media is EditorialHomeHeroMedia => Boolean(media)) ?? null;

  const selectedProfiles = editorialSelection.flatMap((slug) => {
    const panda = pandasBySlug.get(slug);
    if (!panda) return [];
    const name = profileName(panda, locale);
    return [{
      id: panda.id,
      slug: panda.slug,
      name: name.display,
      alternateName: name.alternate,
      summary: localizedText(panda.localized_content, locale) ?? panda.intro ?? name.display,
      birthLabel: birthLabel(panda, locale),
      genderLabel: genderLabel(panda, locale),
      currentPlace: currentPlace(panda, facilitiesById, locale),
      media: buildHeroMedia(panda, locale),
      href: `/${locale}/pandas/${panda.slug}`,
    }];
  });

  const quickLinks = quickSearchSelection.flatMap((slug) => {
    const panda = pandasBySlug.get(slug);
    if (!panda) return [];
    const name = profileName(panda, locale);
    return [{ label: name.display, href: `/${locale}/pandas?q=${encodeURIComponent(name.display)}` }];
  });

  const familyCandidates = familyPreviewSelection.flatMap((slug) => {
    const panda = pandasBySlug.get(slug);
    return panda ? [panda] : [];
  });
  const familyPreview = familyCandidates.length === 3
    && familyCandidates[1].mother_id === familyCandidates[0].id
    && familyCandidates[2].mother_id === familyCandidates[1].id
    ? familyCandidates.map((panda) => {
        const name = profileName(panda, locale);
        return {
          name: name.display,
          alternateName: name.alternate,
          href: `/${locale}/pandas/${panda.slug}`,
        };
      })
    : [];

  const revisions = envelope.data.pandas
    .flatMap((panda) => {
      const summary = localizedText(panda.public_revision?.summaries ?? [], locale);
      if (!summary || !panda.public_revision) return [];
      const name = profileName(panda, locale);
      const verifiedAt = latestVerifiedAt(panda);
      return [{
        panda,
        verifiedAt,
        item: {
          id: panda.id,
          pandaName: name.display,
          alternateName: name.alternate,
          summary,
          verifiedLabel: `${t.revisions.verified}: ${formatDate(verifiedAt, locale)}`,
          href: `/${locale}/pandas/${panda.slug}`,
        },
      }];
    })
    .sort((left, right) => {
      const byDate = (right.verifiedAt ?? "").localeCompare(left.verifiedAt ?? "");
      if (byDate !== 0) return byDate;
      return left.panda.slug.localeCompare(right.panda.slug);
    })
    .slice(0, 4)
    .map(({ item }) => item);

  return {
    hero: {
      ...t.hero,
      searchAction: `/${locale}/pandas`,
      atlasHref: `/${locale}/pandas`,
      quickLinks,
      media: heroMedia,
    },
    profiles: {
      ...t.profiles,
      items: selectedProfiles,
    },
    explorations: {
      eyebrow: t.explorations.eyebrow,
      title: t.explorations.title,
      description: t.explorations.description,
      items: [
        {
          id: "relationships",
          eyebrow: t.explorations.relationships.eyebrow,
          title: t.explorations.relationships.title,
          body: t.explorations.relationships.body,
          primaryLabel: t.explorations.relationships.primaryLabel,
          primaryHref: `/${locale}/families?view=lineage&focus=mei-xiang`,
          secondaryLinks: [
            { label: t.explorations.relationships.secondary, href: `/${locale}/pandas/bao-li` },
          ],
          familyPreview: familyPreview.length ? familyPreview : undefined,
        },
        {
          id: "places",
          eyebrow: t.explorations.places.eyebrow,
          title: t.explorations.places.title,
          body: t.explorations.places.body,
          primaryLabel: t.explorations.places.primaryLabel,
          primaryHref: `/${locale}/map?mode=institutions&snapshot=${encodeURIComponent(envelope.release.id)}`,
          secondaryLinks: [
            { label: t.explorations.places.institution, href: `/${locale}/institutions/smithsonian-national-zoo` },
            { label: t.explorations.places.place, href: `/${locale}/places/wolong-shenshuping-base` },
          ],
        },
      ],
    },
    revisions: {
      ...t.revisions,
      items: revisions,
    },
    method: t.method,
  };
}
