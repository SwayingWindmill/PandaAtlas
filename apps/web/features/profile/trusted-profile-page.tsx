import type { Route } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { TrustedProfileFavorite } from "@/components/atlas/trusted-profile-favorite";
import { ProfileVisitRecorder } from "@/features/preferences/profile-visit-recorder";
import { TrustedProfileMediaGallery } from "@/features/profile/trusted-profile-media-gallery";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import type { PublicContentEnvelope, PublicProfileRecord } from "@/features/public-content/public-release";
import type {
  ProfileModuleState,
  TrustedProfileFactViewModel,
  TrustedProfilePageViewModel,
  TrustedProfileRelationViewModel,
} from "@/features/profile/profile-page-view-model";

export type PublicProfileLocale = "zh" | "en";

interface TrustedProfilePageProps {
  locale: PublicProfileLocale;
  profile: TrustedProfilePageViewModel;
  envelope: PublicContentEnvelope<PublicProfileRecord>;
}

const copy = {
  zh: {
    archive: "可信公开档案",
    complete: "完整档案",
    basic: "基础资料",
    organizing: "资料整理中",
    back: "返回熊猫图鉴",
    stableIdentity: "稳定身份",
    aliases: "名称与检索线索",
    reviewedStory: "已审核档案摘要",
    storyUnavailable: "当前没有这一语言的已审核档案摘要，不生成占位故事。",
    lifeStatus: "生命状态",
    birth: "出生日期",
    sex: "性别",
    place: "当前经核实地点",
    parents: "亲本",
    alive: "存活",
    deceased: "已死亡",
    female: "雌性",
    male: "雄性",
    unknown: "暂无已审核记录",
    missingTranslation: "当前语言名称尚未审核，保留原文名称。",
    conclusionStatus: "结论状态",
    precision: "精度",
    confirmed: "已确认",
    provisional: "暂定",
    tentative: "暂定关系",
    disputed: "有争议",
    superseded: "已取代",
    precisionDay: "日",
    precisionCountry: "国家级",
    precisionCategorical: "分类值",
    precisionUnknown: "未声明",
    candidateValues: "候选值",
    supersededValues: "已取代值",
    verified: "最后核实",
    source: "来源",
    noReviewedSource: "暂无已审核来源结论",
    navLabel: "档案章节",
    nav: [
      ["概览", "overview"],
      ["档案摘要", "story"],
      ["时间线", "timeline"],
      ["家族", "family"],
      ["足迹", "footprint"],
      ["影像", "media"],
      ["来源", "sources"],
      ["修订", "revisions"],
    ],
    timeline: "已审核时间线",
    timelineIntro: "发生日期与来源发布日期分开呈现。宣布迁移不会被写成已经发生。",
    residency: "居住记录",
    transfer: "迁移事件",
    announced: "已宣布",
    completed: "已完成",
    cancelled: "已取消",
    current: "当前记录",
    changesCurrent: "改变当前居住记录",
    noTimeline: "暂无已发布时间线记录。",
    partialTimeline: "当前时间线是已发布子集，不代表完整生平。",
    family: "家族关系",
    familyIntro: "确认和暂定关系分别标记；依赖记录不会被伪装成完整个体档案。",
    father: "父亲",
    mother: "母亲",
    children: "子女",
    siblings: "兄弟姐妹",
    grandparents: "祖辈",
    noRelations: "暂无已发布关系记录。",
    noProfile: "仅有关系依赖记录，暂无完整档案",
    footprint: "迁移足迹",
    footprintIntro: "只展示已发布的机构或粗粒度地点，不推测更精确坐标。",
    noCoordinates: "公开记录没有足够精度用于地理地图。这里采用不带坐标的顺序记录。",
    noFootprint: "暂无已发布居住记录。",
    openPlace: "打开场所实体",
    media: "影像与许可",
    noMedia: "暂无可公开授权影像",
    noMediaBody: "档案明确记录为无已授权媒体。页面不会用来源不明的图片替代。",
    sourceMedia: "仅提供来源媒体链接",
    sourceMediaBody: "来源页面可供查阅，但其影像未导入图鉴，也不在本站重新授权。",
    sourceMediaAction: "前往来源页面",
    mediaUnavailable: "媒体模块没有可发布的许可状态，已按不可用处理。",
    sources: "公开来源",
    sourcesIntro: "关键结论连接公开来源元数据；内部审核材料不在此页面公开。",
    published: "来源发布日期",
    sourceDateUnavailable: "来源发布日期未提供",
    accessible: "可访问",
    changed: "地址或内容已变化",
    restricted: "访问受限",
    unavailable: "当前不可访问",
    revisions: "档案版本与修订",
    revisionUnavailable: "当前没有可发布的修订摘要。",
    revisionPartial: "版本标识可用，但当前语言的修订摘要尚未发布。",
    dataVersion: "Data version",
    schema: "Public Schema",
    moduleComplete: "完整",
    modulePartial: "部分",
    moduleEmpty: "暂无记录",
    moduleUnavailable: "不可用",
  },
  en: {
    archive: "Trusted public archive",
    complete: "Complete profile",
    basic: "Basic record",
    organizing: "Record in progress",
    back: "Back to panda atlas",
    stableIdentity: "Stable identity",
    aliases: "Names and search references",
    reviewedStory: "Reviewed profile summary",
    storyUnavailable: "No reviewed summary is available in this language. A placeholder story is not generated.",
    lifeStatus: "Life status",
    birth: "Birth date",
    sex: "Sex",
    place: "Current verified place",
    parents: "Parents",
    alive: "Alive",
    deceased: "Deceased",
    female: "Female",
    male: "Male",
    unknown: "No reviewed record",
    missingTranslation: "The English name has not been reviewed; the original-language name is retained.",
    conclusionStatus: "Conclusion status",
    precision: "Precision",
    confirmed: "Confirmed",
    provisional: "Provisional",
    tentative: "Tentative relationship",
    disputed: "Disputed",
    superseded: "Superseded",
    precisionDay: "Day",
    precisionCountry: "Country-level",
    precisionCategorical: "Categorical",
    precisionUnknown: "Not stated",
    candidateValues: "Candidate values",
    supersededValues: "Superseded values",
    verified: "Last verified",
    source: "Source",
    noReviewedSource: "No reviewed source conclusion",
    navLabel: "Profile sections",
    nav: [
      ["Overview", "overview"],
      ["Profile summary", "story"],
      ["Timeline", "timeline"],
      ["Family", "family"],
      ["Footprint", "footprint"],
      ["Media", "media"],
      ["Sources", "sources"],
      ["Revisions", "revisions"],
    ],
    timeline: "Reviewed timeline",
    timelineIntro: "Event dates and source publication dates stay distinct. Announcements are not presented as completed moves.",
    residency: "Residency",
    transfer: "Transfer event",
    announced: "Announced",
    completed: "Completed",
    cancelled: "Cancelled",
    current: "Current record",
    changesCurrent: "Changes current residency",
    noTimeline: "No published timeline records are available.",
    partialTimeline: "This timeline is the currently published subset, not a complete life history.",
    family: "Family relationships",
    familyIntro: "Confirmed and tentative relationships are labelled separately. Dependency records are not presented as complete profiles.",
    father: "Father",
    mother: "Mother",
    children: "Children",
    siblings: "Siblings",
    grandparents: "Grandparents",
    noRelations: "No published relationship records are available.",
    noProfile: "Relationship dependency record only; no complete profile",
    footprint: "Migration footprint",
    footprintIntro: "Only published institutions or coarse locations are shown. More precise coordinates are not inferred.",
    noCoordinates: "The public record is not precise enough for a geographic map. This is a coordinate-free ordered record.",
    noFootprint: "No published residency records are available.",
    openPlace: "Open place entity",
    media: "Media and licensing",
    noMedia: "No licensed public media",
    noMediaBody: "The record explicitly states that no licensed media is available. Unverified imagery is not substituted.",
    sourceMedia: "Source-linked media only",
    sourceMediaBody: "The source page may be consulted, but its media is not imported or relicensed by Panda Atlas.",
    sourceMediaAction: "Open source page",
    mediaUnavailable: "The media module has no publishable licence state and is treated as unavailable.",
    sources: "Public sources",
    sourcesIntro: "Key conclusions link to public source metadata. Internal review material is not exposed here.",
    published: "Source published",
    sourceDateUnavailable: "Source publication date unavailable",
    accessible: "Accessible",
    changed: "Address or content changed",
    restricted: "Restricted access",
    unavailable: "Currently unavailable",
    revisions: "Profile version and revision",
    revisionUnavailable: "No publishable revision record is available.",
    revisionPartial: "Version identifiers are available, but no revision summary is published in this language.",
    dataVersion: "Data version",
    schema: "Public Schema",
    moduleComplete: "Complete",
    modulePartial: "Partial",
    moduleEmpty: "No records",
    moduleUnavailable: "Unavailable",
  },
} as const;

function archiveLabel(profile: TrustedProfilePageViewModel, locale: PublicProfileLocale): string {
  if (profile.recordTier === "complete_first_pass") return copy[locale].complete;
  if (profile.recordTier === "identity_first_pass") return copy[locale].basic;
  return copy[locale].organizing;
}

function dateLabel(
  value: string | null,
  locale: PublicProfileLocale,
  precision: "day" | "month" | "year" = "day",
): string {
  if (!value) return copy[locale].unknown;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: precision === "year" ? undefined : "short",
    day: precision === "day" ? "2-digit" : undefined,
    timeZone: "UTC",
  }).format(date);
}

function stateLabel(state: ProfileModuleState, locale: PublicProfileLocale): string {
  const t = copy[locale];
  if (state === "complete") return t.moduleComplete;
  if (state === "partial") return t.modulePartial;
  if (state === "empty") return t.moduleEmpty;
  return t.moduleUnavailable;
}

function factStatusLabel(status: TrustedProfileFactViewModel["status"], locale: PublicProfileLocale): string {
  const t = copy[locale];
  if (status === "confirmed") return t.confirmed;
  if (status === "provisional") return t.provisional;
  if (status === "disputed") return t.disputed;
  if (status === "superseded") return t.superseded;
  return t.unknown;
}

function relationStatusLabel(status: TrustedProfileRelationViewModel["status"], locale: PublicProfileLocale): string {
  const t = copy[locale];
  if (status === "confirmed") return t.confirmed;
  if (status === "tentative") return t.tentative;
  if (status === "disputed") return t.disputed;
  if (status === "superseded") return t.superseded;
  return t.provisional;
}

function precisionLabel(precision: TrustedProfileFactViewModel["precision"], locale: PublicProfileLocale): string {
  const t = copy[locale];
  if (precision === "day") return t.precisionDay;
  if (precision === "country") return t.precisionCountry;
  if (precision === "categorical") return t.precisionCategorical;
  return t.precisionUnknown;
}

function eventStatusLabel(status: string, locale: PublicProfileLocale): string {
  const t = copy[locale];
  if (status === "announced") return t.announced;
  if (status === "completed") return t.completed;
  if (status === "cancelled") return t.cancelled;
  if (status === "disputed") return t.disputed;
  if (status === "confirmed" || status === "confirmed_country_level") return t.confirmed;
  if (status === "provisional") return t.provisional;
  return status;
}

function eventKindLabel(
  kind: TrustedProfilePageViewModel["timeline"]["items"][number]["kind"],
  locale: PublicProfileLocale,
): string {
  const labels = {
    zh: {
      residency: "居住记录",
      birth: "出生事件",
      arrival: "抵达事件",
      transfer: "迁移事件",
      return: "返回事件",
      naming: "命名事件",
      public_debut: "公开亮相",
      selection: "选定事件",
      announcement: "公告事件",
      observation: "观察记录",
      death: "死亡记录",
    },
    en: {
      residency: "Residency",
      birth: "Birth",
      arrival: "Arrival",
      transfer: "Transfer",
      return: "Return",
      naming: "Naming",
      public_debut: "Public debut",
      selection: "Selection",
      announcement: "Announcement",
      observation: "Observation",
      death: "Death",
    },
  } as const;
  return labels[locale][kind];
}

function factValue(fact: TrustedProfileFactViewModel, profile: TrustedProfilePageViewModel, locale: PublicProfileLocale): string {
  const t = copy[locale];
  if (fact.field === "life_status") {
    return fact.value === "alive" ? t.alive : fact.value === "deceased" ? t.deceased : t.unknown;
  }
  if (fact.field === "birth_date") return dateLabel(typeof fact.value === "string" ? fact.value : null, locale);
  if (fact.field === "sex") return fact.value === "female" ? t.female : fact.value === "male" ? t.male : t.unknown;
  return profile.currentPlace.label || t.unknown;
}

function sourceNames(sourceIds: string[], profile: TrustedProfilePageViewModel): string {
  return sourceIds
    .map((sourceId) => profile.sources.find((source) => source.id === sourceId)?.publisher ?? sourceId)
    .join(", ");
}

function ModuleState({ state, locale }: { state: ProfileModuleState; locale: PublicProfileLocale }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--pa-color-accent-border-14)] bg-[var(--pa-color-accent-fill-06)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
      {stateLabel(state, locale)}
    </span>
  );
}

function SourceAnchors({
  sourceIds,
  profile,
  locale,
}: {
  sourceIds: string[];
  profile: TrustedProfilePageViewModel;
  locale: PublicProfileLocale;
}) {
  const t = copy[locale];
  if (!sourceIds.length) return <>{t.noReviewedSource}</>;
  return <>{sourceIds.map((sourceId, index) => {
    const source = profile.sources.find((item) => item.id === sourceId);
    return (
      <span key={sourceId}>
        {index ? ", " : ""}
        <a href={`#${sourceId}`} className="font-semibold text-[var(--accent)] hover:underline">
          {source?.publisher ?? sourceId}
        </a>
      </span>
    );
  })}</>;
}

function FactProvenance({
  fact,
  locale,
  profile,
}: {
  fact: TrustedProfileFactViewModel;
  locale: PublicProfileLocale;
  profile: TrustedProfilePageViewModel;
}) {
  const t = copy[locale];
  const colon = locale === "zh" ? "：" : ": ";
  return (
    <dd className="mt-1 text-xs leading-5 text-[var(--muted)]">
      {t.conclusionStatus}{colon}{factStatusLabel(fact.status, locale)} | {t.precision}{colon}{precisionLabel(fact.precision, locale)}
      <> | {t.source}{colon}<SourceAnchors sourceIds={fact.sourceIds} profile={profile} locale={locale} /></>
      {fact.lastVerifiedAt ? <> | {t.verified}{colon}{fact.lastVerifiedAt}</> : null}
      {fact.candidateValues.length ? <span className="mt-1 block">{t.candidateValues}{colon}{fact.candidateValues.map(String).join(", ")}</span> : null}
      {fact.supersededValues.length ? <span className="mt-1 block">{t.supersededValues}{colon}{fact.supersededValues.map(String).join(", ")}</span> : null}
    </dd>
  );
}

function RelationList({
  title,
  items,
  locale,
  profile,
  testId,
}: {
  title: string;
  items: TrustedProfileRelationViewModel[];
  locale: PublicProfileLocale;
  profile: TrustedProfilePageViewModel;
  testId?: string;
}) {
  const t = copy[locale];
  if (!items.length) return null;
  return (
    <div data-testid={testId}>
      <h3 className="text-xl font-semibold">{title}</h3>
      <ol className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <li key={`${item.relation}-${item.id}`} className="rounded-xl border border-[var(--pa-color-accent-border-09)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                <span className="mr-3 text-[var(--accent)]">{index + 1}.</span>
                {item.href ? (
                  <Link href={item.href as Route} lang={item.nameLanguage} className="font-semibold text-[var(--accent)] hover:underline">
                    {item.name}
                  </Link>
                ) : <span lang={item.nameLanguage} className="font-semibold">{item.name}</span>}
              </p>
              <span className="rounded-full bg-[var(--pa-color-accent-fill-08)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                {relationStatusLabel(item.status, locale)}
              </span>
            </div>
            {!item.profileAvailable ? <p className="mt-2 text-xs text-[var(--muted)]">{t.noProfile}</p> : null}
            <p className="mt-2 text-xs text-[var(--muted)]">
              {t.source}: <SourceAnchors sourceIds={item.sourceIds} profile={profile} locale={locale} />
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TrustedProfilePage({ locale, profile, envelope }: TrustedProfilePageProps) {
  const t = copy[locale];
  const factByField = new Map(profile.facts.map((item) => [item.field, item]));
  const lifeStatusFact = factByField.get("life_status");
  const birthFact = factByField.get("birth_date");
  const sexFact = factByField.get("sex");
  const placeFact = factByField.get("current_coarse_location");
  if (!lifeStatusFact || !birthFact || !sexFact || !placeFact) {
    throw new Error("Trusted profile view model is missing an above-the-fold fact.");
  }

  const parents = profile.family.parents;
  const mediaSources = profile.media.sourceIds.flatMap((sourceId) => {
    const source = profile.sources.find((item) => item.id === sourceId);
    return source ? [source] : [];
  });

  return (
    <>
      <ProfileVisitRecorder stableId={profile.stableId} slug={profile.canonicalSlug} />
      <GlobalNavigation locale={locale} active="profile" alternatePath={profile.alternateLanguageHref} />
      <main
        id="main-content"
        lang={locale === "zh" ? "zh-CN" : "en"}
        className="trusted-profile-theme bg-[var(--bg)] pb-20 text-[var(--fg)]"
        data-testid="trusted-panda-profile"
      >
        <section className={`${publicShellClassName} pt-6`}>
          <PublicDeliveryNotice
            locale={locale}
            release={envelope.release}
            delivery={envelope.delivery}
            coverage={envelope.coverage}
            localeDelivery={envelope.locale}
          />
        </section>

        <section id="overview" className={`${publicShellClassName} scroll-mt-36 py-8 lg:py-12`}>
          <div data-testid="identity-first-card" className="grid gap-8 rounded-2xl border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 shadow-[var(--pa-shadow-profile)] md:p-9 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link href={profile.atlasHref as Route} className="font-semibold text-[var(--accent)] hover:underline">{t.back}</Link>
                <span aria-hidden="true">/</span>
                <span>{archiveLabel(profile, locale)}</span>
              </div>
              <p className="mt-8 text-sm font-semibold text-[var(--accent)]">{t.archive}</p>
              <h1 lang={profile.displayNameLanguage} className="mt-3 text-5xl leading-tight text-[var(--fg)] sm:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
                {profile.displayName}
              </h1>
              {profile.displayNameTranslation === "missing" ? <p className="mt-2 text-sm text-[var(--muted)]">{t.missingTranslation}</p> : null}
              <p className="mt-2 text-lg text-[var(--muted)]">
                {profile.alternateName}{profile.pinyin ? ` / ${profile.pinyin}` : ""}
              </p>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)]">{profile.summary ?? t.unknown}</p>
              {profile.lastVerifiedAt ? <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{t.verified}{locale === "zh" ? "：" : ": "}{profile.lastVerifiedAt}</p> : null}

              <dl className="mt-8 grid gap-5 sm:grid-cols-2">
                {[
                  ["fact-life-status", t.lifeStatus, lifeStatusFact],
                  ["fact-birth", t.birth, birthFact],
                  ["fact-sex", t.sex, sexFact],
                  ["fact-place", t.place, placeFact],
                ].map(([testId, label, fact]) => (
                  <div key={String(testId)} data-testid={String(testId)}>
                    <dt className="text-xs font-semibold text-[var(--muted)]">{String(label)}</dt>
                    <dd className="mt-2 text-lg font-semibold">{factValue(fact as TrustedProfileFactViewModel, profile, locale)}</dd>
                    <FactProvenance fact={fact as TrustedProfileFactViewModel} locale={locale} profile={profile} />
                  </div>
                ))}
                <div data-testid="fact-parents">
                  <dt className="text-xs font-semibold text-[var(--muted)]">{t.parents}</dt>
                  <dd className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-lg font-semibold">
                    {parents.length ? parents.map((item) => item.href ? (
                      <Link key={item.id} href={item.href as Route} lang={item.nameLanguage} className="text-[var(--accent)] hover:underline">{item.name}</Link>
                    ) : <span key={item.id} lang={item.nameLanguage}>{item.name}</span>) : t.noRelations}
                  </dd>
                  <dd className="mt-1 text-xs text-[var(--muted)]">
                    {parents.length ? parents.map((item) => relationStatusLabel(item.status, locale)).join(" / ") : t.noReviewedSource}
                  </dd>
                </div>
              </dl>
            </div>

            <aside className="flex flex-col justify-between gap-8 rounded-2xl bg-[var(--pa-color-accent-fill-07)] p-6">
              <div>
                <p className="text-sm font-semibold text-[var(--accent)]">{archiveLabel(profile, locale)}</p>
                <dl className="mt-4 text-xs">
                  <div>
                    <dt className="text-[var(--muted)]">{t.stableIdentity}</dt>
                    <dd className="mt-1 break-all font-semibold">{profile.stableId}</dd>
                  </div>
                </dl>
                <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{t.aliases}</p>
                <ul className="mt-4 grid gap-2" aria-label={t.aliases}>
                  {profile.identityReferences.map((reference) => (
                    <li key={`${reference.kind}-${reference.value}`} className="rounded-lg border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] px-3 py-2 text-xs">
                      <span className="font-semibold">{reference.value}</span>
                      <span className="mt-1 block text-[var(--muted)]">{t.source}: {sourceNames(reference.sourceIds, profile) || t.noReviewedSource}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <TrustedProfileFavorite
                stableId={profile.stableId}
                slug={profile.canonicalSlug}
                name={profile.displayName}
                locale={locale}
              />
            </aside>
          </div>
        </section>

        <nav aria-label={t.navLabel} className="sticky top-[78px] z-20 border-y border-[var(--pa-color-accent-border-08)] bg-[var(--card)]">
          <div className={`${publicShellClassName} flex gap-5 overflow-x-auto py-3 text-sm font-semibold`}>
            {t.nav.map(([label, id]) => (
              <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-lg px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                {label}
              </a>
            ))}
          </div>
        </nav>

        <section id="story" className={`${publicShellClassName} scroll-mt-36 py-14`} data-testid="reviewed-story">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.reviewedStory}</h2>
            <ModuleState state={profile.story.state === "reviewed" ? "complete" : "unavailable"} locale={locale} />
          </div>
          {profile.story.state === "reviewed" ? (
            <div className="mt-6 max-w-3xl space-y-4 text-base leading-8 text-[var(--muted)]">
              {profile.story.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          ) : <p className="mt-6 text-sm leading-7 text-[var(--muted)]">{t.storyUnavailable}</p>}
        </section>

        <section id="timeline" className={`${publicShellClassName} scroll-mt-36 py-14`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.timeline}</h2>
            <ModuleState state={profile.timeline.state} locale={locale} />
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t.timelineIntro}</p>
          {profile.timeline.state === "partial" ? <p className="mt-3 rounded-xl bg-[var(--pa-color-warning-fill-09)] p-4 text-sm">{t.partialTimeline}</p> : null}
          {profile.timeline.items.length ? (
            <ol className="mt-8 grid gap-4" data-testid="timeline-list">
              {profile.timeline.items.map((item) => (
                <li key={item.id} className="grid gap-3 rounded-xl border border-[var(--pa-color-accent-border-09)] bg-[var(--card)] p-5 sm:grid-cols-[9rem_1fr]">
                  <div>
                    <time className="font-semibold" dateTime={item.date}>{dateLabel(item.date, locale, item.datePrecision)}</time>
                    <p className="mt-1 text-xs text-[var(--accent)]">{eventKindLabel(item.kind, locale)}</p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-semibold">{item.fromLabel ? `${item.fromLabel} → ${item.toLabel}` : item.toLabel || t.unknown}</p>
                      <span className="rounded-full bg-[var(--pa-color-accent-fill-08)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">{eventStatusLabel(item.status, locale)}</span>
                    </div>
                    {item.endDate ? <p className="mt-2 text-sm text-[var(--muted)]">{dateLabel(item.date, locale, item.datePrecision)} - {dateLabel(item.endDate, locale, item.endPrecision ?? "day")}</p> : item.kind === "residency" ? <p className="mt-2 text-sm text-[var(--muted)]">{t.current}</p> : null}
                    {item.changesCurrentResidency ? <p className="mt-2 text-xs font-semibold text-[var(--accent)]">{t.changesCurrent}</p> : null}
                    <p className="mt-2 text-xs text-[var(--muted)]">{t.source}: <SourceAnchors sourceIds={item.sourceIds} profile={profile} locale={locale} /></p>
                    <ul className="mt-1 text-xs text-[var(--muted)]">
                      {item.sourceIds.map((sourceId) => {
                        const source = profile.sources.find((candidate) => candidate.id === sourceId);
                        return <li key={sourceId}>{t.published}: {source?.publishedAt ? dateLabel(source.publishedAt, locale) : t.sourceDateUnavailable}</li>;
                      })}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="mt-6 text-sm text-[var(--muted)]" data-testid="timeline-empty-state">{t.noTimeline}</p>}
        </section>

        <section id="family" className="scroll-mt-36 bg-[var(--card)] py-14">
          <div className={publicShellClassName}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.family}</h2>
              <ModuleState state={profile.family.state} locale={locale} />
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t.familyIntro}</p>
            {profile.family.state === "empty" ? <p className="mt-6 text-sm text-[var(--muted)]">{t.noRelations}</p> : (
              <div className="mt-8 grid gap-8 lg:grid-cols-2" data-testid="lineage-text-view">
                <RelationList title={t.parents} items={profile.family.parents} locale={locale} profile={profile} testId="parent-relations" />
                <RelationList title={t.children} items={profile.family.children} locale={locale} profile={profile} testId="child-relations" />
                <RelationList title={t.siblings} items={profile.family.related.filter((item) => item.relation === "sibling")} locale={locale} profile={profile} />
                <RelationList title={t.grandparents} items={profile.family.related.filter((item) => item.relation === "grandparent")} locale={locale} profile={profile} />
              </div>
            )}
          </div>
        </section>

        <section id="footprint" className={`${publicShellClassName} scroll-mt-36 py-14`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.footprint}</h2>
            <ModuleState state={profile.footprint.state} locale={locale} />
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t.footprintIntro}</p>
          <p className="mt-3 text-sm text-[var(--muted)]">{t.noCoordinates}</p>
          {profile.footprint.stops.length ? (
            <ol className="mt-8 grid gap-3" data-testid="footprint-text-view">
              {profile.footprint.stops.map((item, index) => (
                <li key={item.id} className="rounded-xl border border-[var(--pa-color-accent-border-09)] bg-[var(--card)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{index + 1}. {item.label || t.unknown}</p>
                    <span className="rounded-full bg-[var(--pa-color-accent-fill-08)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">{eventStatusLabel(item.status, locale)}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{dateLabel(item.startDate, locale, item.startPrecision)} - {item.endDate ? dateLabel(item.endDate, locale, item.endPrecision ?? "day") : t.current}</p>
                  {item.lastVerifiedAt ? <p className="mt-2 text-xs text-[var(--muted)]">{t.verified}: {item.lastVerifiedAt}</p> : null}
                  <p className="mt-2 text-xs text-[var(--muted)]">{t.source}: <SourceAnchors sourceIds={item.sourceIds} profile={profile} locale={locale} /></p>
                  {item.entityHref ? (
                    <Link href={item.entityHref as Route} className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline">
                      {t.openPlace}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : <p className="mt-6 text-sm text-[var(--muted)]">{t.noFootprint}</p>}
        </section>

        <section id="media" className="scroll-mt-36 bg-[var(--card)] py-14">
          <div className={publicShellClassName}>
            <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.media}</h2>
            {profile.media.state === "gallery" ? (
              <TrustedProfileMediaGallery locale={locale} media={profile.media} />
            ) : null}
            {profile.media.state === "no_licensed_media" ? (
              <div className="mt-8 rounded-2xl border border-dashed border-[var(--pa-color-accent-border-22)] bg-[var(--pa-color-accent-fill-05)] p-8 sm:p-12" data-testid="media-empty-state">
                <p className="text-2xl font-semibold">{t.noMedia}</p>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{t.noMediaBody}</p>
              </div>
            ) : null}
            {profile.media.state === "source_link_only" ? (
              <div className="mt-8 rounded-2xl border border-[var(--pa-color-accent-border-12)] bg-[var(--pa-color-accent-fill-05)] p-8 sm:p-12" data-testid="media-source-link-state">
                <p className="text-2xl font-semibold">{t.sourceMedia}</p>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{t.sourceMediaBody}</p>
                {mediaSources.map((source) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="mt-5 mr-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline">
                    {t.sourceMediaAction}<ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : null}
            {profile.media.state === "unavailable" ? <p className="mt-8 text-sm text-[var(--muted)]">{t.mediaUnavailable}</p> : null}
          </div>
        </section>

        <section id="sources" className={`${publicShellClassName} scroll-mt-36 py-14`}>
          <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.sources}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t.sourcesIntro}</p>
          <div className="mt-8 grid gap-4" data-testid="evidence-list">
            {profile.sources.map((source) => (
              <article id={source.id} key={source.id} className="scroll-mt-36 rounded-xl border border-[var(--pa-color-accent-border-09)] bg-[var(--card)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[var(--accent)]">{source.publisher}</p>
                  <span className="rounded-full bg-[var(--pa-color-accent-fill-08)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                    {source.accessState === "accessible" ? t.accessible : source.accessState === "changed" ? t.changed : source.accessState === "restricted" ? t.restricted : t.unavailable}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-semibold">{source.title}</h3>
                <p className="mt-2 text-xs text-[var(--muted)]">{t.published}: {source.publishedAt ? dateLabel(source.publishedAt, locale) : t.sourceDateUnavailable} | {t.verified}: {source.lastVerifiedAt}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{source.language} · {source.rawAccessState}</p>
                <a href={source.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline">
                  {t.source}<ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section id="revisions" className="scroll-mt-36 bg-[var(--card)] py-14">
          <div className={publicShellClassName} data-testid="revision-summary">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.revisions}</h2>
              <ModuleState state={profile.revision.state === "reviewed" ? "complete" : profile.revision.state === "partial" ? "partial" : "unavailable"} locale={locale} />
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              {profile.revision.summary ?? (profile.revision.state === "partial" ? t.revisionPartial : t.revisionUnavailable)}
            </p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-[var(--muted)]">{t.dataVersion}</dt><dd className="mt-1 font-semibold">{profile.revision.dataVersion ?? t.unknown}</dd></div>
              <div><dt className="text-[var(--muted)]">{t.schema}</dt><dd className="mt-1 font-semibold">{profile.revision.publicSchemaVersion ?? t.unknown}</dd></div>
            </dl>
          </div>
        </section>
      </main>
    </>
  );
}
