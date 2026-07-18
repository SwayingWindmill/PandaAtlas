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
  selectionReason: string;
  currentPlace: string;
  recordState: string;
  mediaState: string;
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
}

export interface EditorialHomeRevision {
  id: string;
  pandaName: string;
  alternateName: string | null;
  summary: string;
  verifiedLabel: string;
  releaseLabel: string;
  href: string;
}

export interface EditorialHomeMethodItem {
  title: string;
  body: string;
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
    noMediaLabel: string;
    noMediaTitle: string;
    noMediaBody: string;
    releaseLabel: string;
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

const editorialSelection = ["mei-xiang", "bao-li", "xiao-qi-ji"] as const;

const copy = {
  zh: {
    hero: {
      eyebrow: "PandaAtlas 可信公开档案",
      title: "从一只熊猫开始，查证身份、亲缘与迁移",
      description: "这是一个双语、持续修订的公开档案馆。搜索已审核身份，沿亲缘或地点继续探索，并查看每条档案如何被来源与版本支持。",
      searchLabel: "搜索公开熊猫档案",
      inputLabel: "熊猫名称、别名或公开标识",
      placeholder: "例如：美香、Mei Xiang、meixiang",
      searchButton: "搜索档案",
      atlasLabel: "浏览全部已发布档案",
      noMediaLabel: "无媒体安全的档案入口",
      noMediaTitle: "图片不是身份或事实证据",
      noMediaBody: "当前首页只使用已审核文字、结构化关系、地点与来源。没有明确许可的媒体时，任务仍然完整可用。",
      releaseLabel: "当前公开发布",
    },
    profiles: {
      eyebrow: "编辑精选",
      title: "三个进入档案馆的起点",
      description: "这些档案由编辑按可解释的研究任务选出，用于展示身份、亲缘、迁移和地点之间的不同路径。",
      selectionDisclosure: "这是编辑选择，不是热度、访问量或受欢迎程度排名。",
    },
    selectionReasons: {
      "mei-xiang": "适合查阅完整身份、长期驻留、迁移事件与多代亲缘。",
      "bao-li": "适合从第三代身份进入当前机构、地点与母系亲缘。",
      "xiao-qi-ji": "适合从出生记录、共同回国事件追踪到现居基地。",
    },
    explorations: {
      eyebrow: "关系与地点",
      title: "不必先知道名字，也能开始探索",
      description: "从已审核亲缘关系或公开地点精度进入同一份版本化档案。",
      relationships: {
        eyebrow: "从关系开始",
        title: "沿美香家族查看父母、子女与代际",
        body: "结构化谱系区分已确认、暂定和不可公开的关系，并保留每条亲本断言的来源。",
        primaryLabel: "打开结构化谱系",
        secondary: "查看宝力档案",
      },
      places: {
        eyebrow: "从地点开始",
        title: "从机构与场所查看当前及历史驻留",
        body: "地图、机构和场所页面保持组织身份与物理地点分离，不从国家级或地区级记录推断精确坐标。",
        primaryLabel: "打开结构化地图",
        institution: "史密森国家动物园机构",
        place: "卧龙神树坪基地场所",
      },
    },
    revisions: {
      eyebrow: "最近档案修订",
      title: "查看本次公开发布整理了什么",
      description: "修订摘要直接来自已发布记录，并与最后核实日期和公开 Release 绑定。",
      empty: "当前公开发布没有可展示的本地化修订摘要。",
      verified: "最后核实",
      release: "公开发布",
    },
    method: {
      eyebrow: "档案方法",
      title: "先说明证据，再展示结论",
      description: "PandaAtlas 不用生成式故事、来源不明图片或静默示例数据补齐档案。证据不足时，页面会明确显示未知、部分可用或不可用。",
      items: [
        {
          title: "稳定身份与双语解析",
          body: "中文名、英文名、拼音、历史拼写与外部公开标识解析到同一个稳定身份；切换语言不会切换事实版本。",
        },
        {
          title: "来源、精度与修订同时公开",
          body: "关键结论保留来源、最后核实时间、地点精度、事实状态和公开版本，避免把不确定信息写成确定事实。",
        },
        {
          title: "没有授权媒体也能完成任务",
          body: "搜索、身份、亲缘、驻留、迁移、来源与修订不依赖英雄图片；无许可媒体使用设计化空状态。",
        },
      ],
    },
    labels: {
      complete: "首轮完整档案",
      partial: "部分公开档案",
      noMedia: "无授权媒体",
      sourceMedia: "仅来源链接",
      licensedMedia: "已许可媒体",
      unknownPlace: "现居地点未公开",
      countryChina: "中国（国家级记录）",
    },
  },
  en: {
    hero: {
      eyebrow: "PandaAtlas trusted public archive",
      title: "Start with one panda. Verify identity, lineage, and movement.",
      description: "A bilingual, continuously revised public archive. Search reviewed identities, continue through relationships or places, and see how each profile is supported by sources and releases.",
      searchLabel: "Search public panda profiles",
      inputLabel: "Panda name, alias, or public identifier",
      placeholder: "For example: Mei Xiang, 美香, meixiang",
      searchButton: "Search profiles",
      atlasLabel: "Browse every published profile",
      noMediaLabel: "No-media-safe archive entry",
      noMediaTitle: "Imagery is not identity or fact evidence",
      noMediaBody: "The Home uses reviewed text, structured relationships, places, and sources. The research task remains complete when no clearly licensed media is available.",
      releaseLabel: "Current public release",
    },
    profiles: {
      eyebrow: "Editorial selections",
      title: "Three ways into the archive",
      description: "Editors selected these profiles for distinct, explainable research tasks across identity, lineage, movement, and place.",
      selectionDisclosure: "These are editorial selections, not rankings by popularity, traffic, or engagement.",
    },
    selectionReasons: {
      "mei-xiang": "Review a complete identity, long-term residencies, transfer events, and multigenerational lineage.",
      "bao-li": "Enter through a third-generation identity connected to a current institution, place, and maternal lineage.",
      "xiao-qi-ji": "Trace a birth record and shared return event through to the current base.",
    },
    explorations: {
      eyebrow: "Relationships and places",
      title: "Begin exploring without knowing a name",
      description: "Enter the same versioned archive through reviewed relationships or public location precision.",
      relationships: {
        eyebrow: "Start with relationships",
        title: "Follow Mei Xiang's family across parents, children, and generations",
        body: "Structured lineage distinguishes confirmed, tentative, and unavailable relationships while retaining the source path for each parentage assertion.",
        primaryLabel: "Open structured lineage",
        secondary: "Open Bao Li's profile",
      },
      places: {
        eyebrow: "Start with places",
        title: "Review current and historical residencies by institution and place",
        body: "Map, institution, and place pages keep organization identity separate from physical place and never infer exact coordinates from country- or locality-level records.",
        primaryLabel: "Open structured map",
        institution: "Smithsonian institution",
        place: "Wolong Shenshuping place",
      },
    },
    revisions: {
      eyebrow: "Recent archive revisions",
      title: "See what this public release reviewed",
      description: "Revision summaries come directly from published records and remain bound to their last verification date and public release.",
      empty: "This public release contains no localized revision summaries to display.",
      verified: "Last verified",
      release: "Public release",
    },
    method: {
      eyebrow: "Archive method",
      title: "Evidence before conclusions",
      description: "PandaAtlas does not complete profiles with generated stories, unverified imagery, or silent demo data. When evidence is insufficient, the interface says unknown, partial, or unavailable.",
      items: [
        {
          title: "Stable identity and bilingual resolution",
          body: "Chinese names, English names, pinyin, historic spellings, and external public identifiers resolve to one stable identity. Changing language does not change the fact release.",
        },
        {
          title: "Sources, precision, and revisions together",
          body: "Key conclusions retain sources, verification dates, location precision, fact status, and release identity so uncertainty is not presented as certainty.",
        },
        {
          title: "The task works without licensed media",
          body: "Search, identity, lineage, residency, movement, sources, and revisions do not depend on hero imagery. Designed empty states replace unlicensed media.",
        },
      ],
    },
    labels: {
      complete: "Complete first-pass profile",
      partial: "Partial public profile",
      noMedia: "No licensed media",
      sourceMedia: "Source link only",
      licensedMedia: "Licensed media",
      unknownPlace: "Current place not published",
      countryChina: "China (country-level record)",
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

function mediaLabel(panda: PandaDetail, locale: PublicLocale): string {
  const t = copy[locale].labels;
  if (panda.media_release?.license_state === "licensed") return t.licensedMedia;
  if (panda.media_release?.license_state === "source_link_only") return t.sourceMedia;
  return t.noMedia;
}

export function buildEditorialHomeViewModel(
  envelope: PublicContentEnvelope<PublicAtlasDataset>,
  locale: PublicLocale,
): EditorialHomeViewModel {
  const t = copy[locale];
  const pandasBySlug = new Map(envelope.data.pandas.map((panda) => [panda.slug, panda]));
  const facilitiesById = new Map(envelope.data.facilities.map((facility) => [facility.id, facility]));

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
      selectionReason: t.selectionReasons[slug],
      currentPlace: currentPlace(panda, facilitiesById, locale),
      recordState: panda.record_tier === "complete_first_pass" ? t.labels.complete : t.labels.partial,
      mediaState: mediaLabel(panda, locale),
      href: `/${locale}/atlas/${panda.slug}`,
    }];
  });

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
          releaseLabel: `${t.revisions.release}: ${panda.public_revision.data_version}`,
          href: `/${locale}/atlas/${panda.slug}`,
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
      searchAction: `/${locale}/atlas`,
      atlasHref: `/${locale}/atlas`,
      releaseLabel: `${t.hero.releaseLabel} · ${envelope.release.id} · Public Schema ${envelope.release.schemaVersion}`,
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
          primaryHref: `/${locale}/lineage?focus=mei-xiang`,
          secondaryLinks: [
            { label: t.explorations.relationships.secondary, href: `/${locale}/atlas/bao-li` },
          ],
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
