import type { Route } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PandaFavoriteControl } from "@/components/pandas/panda-favorite-control";
import { PandaSeenControl } from "@/components/pandas/panda-seen-control";
import { PublicPandaActivity } from "@/features/feed/public-panda-activity";
import type { ActivityPageData } from "@/features/feed/types";
import { ProfileVisitRecorder } from "@/features/preferences/profile-visit-recorder";
import {
  familyStoriesForPanda,
  getProfileCohortState,
  localizedEditorial,
} from "@/features/public-experiences/stories";
import { TrustedProfileMediaGallery } from "@/features/profile/trusted-profile-media-gallery";
import { publicShellClassName } from "@/components/patterns/public-shell";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import { LicensedMediaFigure } from "@/components/patterns/licensed-media-figure";
import type { PublicContentEnvelope, PublicProfileRecord } from "@/features/public-content/public-release";
import { buildPandaStructuredData, serializeStructuredData } from "@/foundation/metadata/panda-structured-data";
import type { PandaListItem } from "@/lib/types";
import type {
  ProfileModuleState,
  TrustedProfileFactViewModel,
  TrustedProfilePageViewModel,
  TrustedProfileRelationViewModel,
} from "@/features/profile/profile-page-view-model";

import styles from "./trusted-profile-page.module.css";

export type PublicProfileLocale = "zh" | "en";

interface TrustedProfilePageProps {
  locale: PublicProfileLocale;
  profile: TrustedProfilePageViewModel;
  envelope: PublicContentEnvelope<PublicProfileRecord>;
  activity?: ActivityPageData;
  activityUnavailable?: boolean;
  activityPandas?: PandaListItem[];
}

const copy = {
  zh: {
    complete: "资料较完整",
    basic: "基础资料",
    organizing: "资料整理中",
    back: "全部熊猫",
    stableIdentity: "身份记录",
    aliases: "名字与搜索线索",
    reviewedStory: "简介",
    storyUnavailable: "当前没有这一语言的经核实简介。吱熊猫不会生成占位故事。",
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
    navLabel: "熊猫资料章节",
    nav: [
      ["概览", "overview"],
      ["简介", "story"],
      ["经历", "timeline"],
      ["家人", "family"],
      ["足迹", "footprint"],
      ["照片", "media"],
      ["来源", "sources"],
      ["版本", "revisions"],
    ],
    timeline: "经历",
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
    family: "家人",
    familyIntro: "已确认、暂定和有争议的关系会分别标记；只有家族线索的记录不会被显示成完整熊猫资料。",
    father: "父亲",
    mother: "母亲",
    children: "子女",
    siblings: "兄弟姐妹",
    grandparents: "祖辈",
    noRelations: "暂无已发布关系记录。",
    noProfile: "目前只有家族关系记录，暂无完整熊猫资料",
    footprint: "生活过的地方",
    footprintIntro: "只展示已发布的机构或粗粒度地点，不推测更精确坐标。",
    noCoordinates: "公开记录没有足够精度用于地理地图。这里采用不带坐标的顺序记录。",
    noFootprint: "暂无已发布居住记录。",
    openPlace: "查看这个地点",
    media: "照片与许可",
    noMedia: "暂无可公开授权影像",
    noMediaBody: "当前资料明确记录为没有可公开授权的影像。页面不会用来源不明或其他熊猫的图片替代。",
    sourceMedia: "仅提供来源媒体链接",
    sourceMediaBody: "来源页面可供查阅，但其影像未导入图鉴，也不在本站重新授权。",
    sourceMediaAction: "前往来源页面",
    mediaUnavailable: "媒体模块没有可发布的许可状态，已按不可用处理。",
    sources: "资料来源",
    sourcesIntro: "关键资料可继续查看公开来源和最后核实时间；内部审核材料不会在此页面公开。",
    published: "来源发布日期",
    sourceDateUnavailable: "来源发布日期未提供",
    accessible: "可访问",
    changed: "地址或内容已变化",
    restricted: "访问受限",
    unavailable: "当前不可访问",
    revisions: "资料版本",
    revisionUnavailable: "当前没有可发布的修订摘要。",
    revisionPartial: "版本标识可用，但当前语言的修订摘要尚未发布。",
    dataVersion: "资料版本",
    schema: "数据结构版本",
    moduleComplete: "完整",
    modulePartial: "部分",
    moduleEmpty: "暂无记录",
    moduleUnavailable: "不可用",
  },
  en: {
    complete: "More complete profile",
    basic: "Basic record",
    organizing: "Record in progress",
    back: "All pandas",
    stableIdentity: "Identity record",
    aliases: "Names and search references",
    reviewedStory: "About",
    storyUnavailable: "No verified introduction is available in this language. ZhiPanda does not generate a placeholder story.",
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
    navLabel: "Panda profile sections",
    nav: [
      ["Overview", "overview"],
      ["About", "story"],
      ["Life story", "timeline"],
      ["Family", "family"],
      ["Places", "footprint"],
      ["Photos", "media"],
      ["Sources", "sources"],
      ["Version", "revisions"],
    ],
    timeline: "Life story",
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
    family: "Family",
    familyIntro: "Confirmed, tentative, and disputed relationships are labelled separately. Family-only records are not presented as complete panda profiles.",
    father: "Father",
    mother: "Mother",
    children: "Children",
    siblings: "Siblings",
    grandparents: "Grandparents",
    noRelations: "No published relationship records are available.",
    noProfile: "Family relationship record only; no complete panda profile yet",
    footprint: "Places lived",
    footprintIntro: "Only published institutions or coarse locations are shown. More precise coordinates are not inferred.",
    noCoordinates: "The public record is not precise enough for a geographic map. This is a coordinate-free ordered record.",
    noFootprint: "No published residency records are available.",
    openPlace: "View this place",
    media: "Photos and licences",
    noMedia: "No licensed public media",
    noMediaBody: "The current information states that no licensed public media is available. Unverified imagery or a different panda is never substituted.",
    sourceMedia: "Source-linked media only",
    sourceMediaBody: "The source page may be consulted, but its media is not imported or relicensed by ZhiPanda.",
    sourceMediaAction: "Open source page",
    mediaUnavailable: "The media module has no publishable licence state and is treated as unavailable.",
    sources: "Sources",
    sourcesIntro: "Key information links to public sources and last-verified dates. Internal review material is not exposed here.",
    published: "Source published",
    sourceDateUnavailable: "Source publication date unavailable",
    accessible: "Accessible",
    changed: "Address or content changed",
    restricted: "Restricted access",
    unavailable: "Currently unavailable",
    revisions: "Data version",
    revisionUnavailable: "No publishable revision record is available.",
    revisionPartial: "Version identifiers are available, but no revision summary is published in this language.",
    dataVersion: "Information version",
    schema: "Data structure version",
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
  return <span className={styles.state}>{stateLabel(state, locale)}</span>;
}

function SectionHead({
  title,
  intro,
  state,
  locale,
}: {
  title: string;
  intro?: string;
  state?: ProfileModuleState;
  locale: PublicProfileLocale;
}) {
  return (
    <header className={styles.sectionHead}>
      <div>
        <h2>{title}</h2>
        {intro ? <p>{intro}</p> : null}
      </div>
      {state ? <ModuleState state={state} locale={locale} /> : null}
    </header>
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
        <a href={`#${sourceId}`}>{source?.publisher ?? sourceId}</a>
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
    <dd className={styles.provenance}>
      {factStatusLabel(fact.status, locale)} · {t.precision}{colon}{precisionLabel(fact.precision, locale)}
      <span>{t.source}{colon}<SourceAnchors sourceIds={fact.sourceIds} profile={profile} locale={locale} /></span>
      {fact.lastVerifiedAt ? <span>{t.verified}{colon}{fact.lastVerifiedAt}</span> : null}
      {fact.candidateValues.length ? <span>{t.candidateValues}{colon}{fact.candidateValues.map(String).join(", ")}</span> : null}
      {fact.supersededValues.length ? <span>{t.supersededValues}{colon}{fact.supersededValues.map(String).join(", ")}</span> : null}
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
      <h3 className={styles.kinTitle}>{title}</h3>
      <ol className={styles.kin}>
        {items.map((item) => {
          return (
            <li key={`${item.relation}-${item.id}`}>
              <i aria-hidden="true">{Array.from(item.name)[0]}</i>
              <span>
                {item.href
                  ? <Link href={item.href as Route} lang={item.nameLanguage}>{item.name}</Link>
                  : <b lang={item.nameLanguage}>{item.name}</b>}
                <small>
                  {relationStatusLabel(item.status, locale)}
                  {!item.profileAvailable ? ` · ${t.noProfile}` : null}
                </small>
                <small>{t.source}: <SourceAnchors sourceIds={item.sourceIds} profile={profile} locale={locale} /></small>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function TrustedProfilePage({
  locale,
  profile,
  envelope,
  activity,
  activityUnavailable = false,
  activityPandas = [],
}: TrustedProfilePageProps) {
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
  const primaryMedia = profile.media.items.find((item) => item.status === "available" && item.url)
    ?? null;
  const primarySrcSet = primaryMedia?.derivatives.length
    ? primaryMedia.derivatives.map((derivative) => `${derivative.url} ${derivative.width}w`).join(", ")
    : undefined;
  const cohortState = getProfileCohortState(profile.canonicalSlug);
  const familyStories = familyStoriesForPanda(profile.stableId);
  const cohortLabel = locale === "zh"
    ? { rich: "丰富档案", sparse: "基础档案", historic: "历史档案", standard: "熊猫档案" }[cohortState]
    : { rich: "Rich profile", sparse: "Basic profile", historic: "Historic profile", standard: "Panda profile" }[cohortState];
  const mediaSources = profile.media.sourceIds.flatMap((sourceId) => {
    const source = profile.sources.find((item) => item.id === sourceId);
    return source ? [source] : [];
  });
  const structuredData = serializeStructuredData(buildPandaStructuredData({
    locale,
    stableId: profile.stableId,
    canonicalSlug: profile.canonicalSlug,
    displayName: profile.displayName,
    alternateName: profile.alternateName,
    pinyin: profile.pinyin,
    summary: profile.summary,
    coverImageUrl: envelope.data.panda.cover_image_url,
  }));
  const shell = publicShellClassName;
  // A stale or partial delivery is a warning the reader needs before the facts; a live one is a footnote.
  const deliveryNotice = (
    <PublicDeliveryNotice
      locale={locale}
      release={envelope.release}
      delivery={envelope.delivery}
      coverage={envelope.coverage}
      localeDelivery={envelope.locale}
    />
  );
  const deliveryIsLive = envelope.delivery.state === "live";

  return (
    <>
      <script
        type="application/ld+json"
        data-testid="panda-structured-data"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <ProfileVisitRecorder stableId={profile.stableId} slug={profile.canonicalSlug} />
      <main
        id="main-content"
        lang={locale === "zh" ? "zh-CN" : "en"}
        className={styles.page}
        data-testid="trusted-panda-profile"
      >
        {deliveryIsLive ? null : <div className={`${shell} ${styles.alert}`}>{deliveryNotice}</div>}

        <nav className={`${shell} ${styles.crumbs}`} aria-label={locale === "zh" ? "位置" : "Breadcrumb"}>
          <Link href={profile.atlasHref as Route}>{t.back}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{profile.displayName}</span>
        </nav>

        <section id="overview" className={`${shell} ${styles.hero}`} data-testid="identity-first-card">
          <div className={styles.heroMedia}>
            <LicensedMediaFigure
              locale={locale}
              variant="profile"
              src={primaryMedia?.url ?? null}
              srcSet={primarySrcSet}
              sizes="(min-width: 1000px) 55vw, 100vw"
              width={primaryMedia?.width}
              height={primaryMedia?.height}
              alt={primaryMedia?.alt ?? t.noMedia}
              credit={primaryMedia?.credit}
              rights={primaryMedia?.rights}
              sourceUrl={primaryMedia?.sourceUrl}
              fallbackTitle={t.noMedia}
              fallbackBody={t.noMediaBody}
              priority
              testId="profile-hero-media"
            />
          </div>
          <div className={styles.heroCopy}>
            <p className={styles.badges}>
              <span>{cohortLabel}</span>
              <span>{archiveLabel(profile, locale)}</span>
            </p>
            <h1 lang={profile.displayNameLanguage}>{profile.displayName}</h1>
            {profile.displayNameTranslation === "missing" ? <p className={styles.note}>{t.missingTranslation}</p> : null}
            <p className={styles.alt}>{profile.alternateName}{profile.pinyin ? ` · ${profile.pinyin}` : ""}</p>
            <p className={styles.bio}>{profile.summary ?? t.unknown}</p>

            <dl className={styles.facts}>
              {([
                ["fact-life-status", t.lifeStatus, lifeStatusFact],
                ["fact-birth", t.birth, birthFact],
                ["fact-sex", t.sex, sexFact],
                ["fact-place", t.place, placeFact],
              ] as const).map(([testId, label, fact]) => (
                <div key={testId} data-testid={testId}>
                  <dt>{label}</dt>
                  <dd>{factValue(fact, profile, locale)}</dd>
                  <FactProvenance fact={fact} locale={locale} profile={profile} />
                </div>
              ))}
              <div data-testid="fact-parents">
                <dt>{t.parents}</dt>
                <dd>
                  {parents.length ? parents.map((item, index) => (
                    <span key={item.id}>
                      {index ? " · " : ""}
                      {item.href
                        ? <Link href={item.href as Route} lang={item.nameLanguage}>{item.name}</Link>
                        : <span lang={item.nameLanguage}>{item.name}</span>}
                    </span>
                  )) : t.noRelations}
                </dd>
                <dd className={styles.provenance}>
                  {parents.length ? parents.map((item) => relationStatusLabel(item.status, locale)).join(" / ") : t.noReviewedSource}
                </dd>
              </div>
            </dl>

            <div className={styles.actions}>
              <PandaFavoriteControl stableId={profile.stableId} slug={profile.canonicalSlug} name={profile.displayName} locale={locale} />
              <PandaSeenControl stableId={profile.stableId} slug={profile.canonicalSlug} name={profile.displayName} locale={locale} />
            </div>

            <ul className={styles.explore} aria-label={locale === "zh" ? "继续探索" : "Continue exploring"}>
              <li><Link href={`/${locale}/moments?panda=${profile.canonicalSlug}` as Route}>{locale === "zh" ? "查看熊猫时光" : "View Panda Moments"}</Link></li>
              <li><Link href={`/${locale}/families?view=lineage&focus=${profile.canonicalSlug}` as Route}>{locale === "zh" ? "查看家族谱系" : "View family lineage"}</Link></li>
              {familyStories.map((story) => (
                <li key={story.id}>
                  <Link href={`/${locale}/families/${story.slug}` as Route}>{localizedEditorial(story.localized_content, locale).title}</Link>
                </li>
              ))}
            </ul>
            {profile.lastVerifiedAt ? <p className={styles.note}>{t.verified}{locale === "zh" ? "：" : ": "}{profile.lastVerifiedAt}</p> : null}
          </div>
        </section>

        <nav aria-label={t.navLabel} className={styles.sectionNav}>
          <div className={shell}>
            {t.nav.map(([label, id]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </div>
        </nav>

        {activity || activityUnavailable ? (
          <div className={`${shell} ${styles.section}`}>
            <PublicPandaActivity
              locale={locale}
              panda={envelope.data.panda}
              pandas={activityPandas.length ? activityPandas : [envelope.data.panda]}
              activity={activity}
              unavailable={activityUnavailable}
            />
          </div>
        ) : null}

        <section id="story" className={`${shell} ${styles.section}`} data-testid="reviewed-story">
          <SectionHead title={t.reviewedStory} state={profile.story.state === "reviewed" ? "complete" : "unavailable"} locale={locale} />
          {profile.story.state === "reviewed" ? (
            <div className={styles.story}>
              {profile.story.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          ) : <p className={styles.empty}>{t.storyUnavailable}</p>}
        </section>

        <div className={`${shell} ${styles.two}`}>
          <section id="timeline" className={`${styles.box} ${styles.soft}`}>
            <SectionHead title={t.timeline} intro={t.timelineIntro} state={profile.timeline.state} locale={locale} />
            {profile.timeline.state === "partial" ? <p className={styles.warning}>{t.partialTimeline}</p> : null}
            {profile.timeline.items.length ? (
              <ol className={styles.timeline} data-testid="timeline-list">
                {profile.timeline.items.map((item) => (
                  <li key={item.id} data-current={item.kind === "residency" && !item.endDate ? "" : undefined}>
                    <p className={styles.when}>
                      <time dateTime={item.date}>{dateLabel(item.date, locale, item.datePrecision)}</time>
                      {item.endDate ? <> – {dateLabel(item.endDate, locale, item.endPrecision ?? "day")}</> : null}
                      {" · "}{eventKindLabel(item.kind, locale)} · {eventStatusLabel(item.status, locale)}
                    </p>
                    <p className={styles.what}>{item.fromLabel ? `${item.fromLabel} → ${item.toLabel}` : item.toLabel || t.unknown}</p>
                    {!item.endDate && item.kind === "residency" ? <p className={styles.tiny}>{t.current}</p> : null}
                    {item.changesCurrentResidency ? <p className={styles.tiny}>{t.changesCurrent}</p> : null}
                    <p className={styles.tiny}>
                      {t.source}: <SourceAnchors sourceIds={item.sourceIds} profile={profile} locale={locale} />
                      {item.sourceIds.map((sourceId) => {
                        const source = profile.sources.find((candidate) => candidate.id === sourceId);
                        return <span key={sourceId}> · {t.published}: {source?.publishedAt ? dateLabel(source.publishedAt, locale) : t.sourceDateUnavailable}</span>;
                      })}
                    </p>
                  </li>
                ))}
              </ol>
            ) : <p className={styles.empty} data-testid="timeline-empty-state">{t.noTimeline}</p>}
          </section>

          <section id="family" className={`${styles.box} ${styles.outline}`}>
            <SectionHead title={t.family} intro={t.familyIntro} state={profile.family.state} locale={locale} />
            {profile.family.state === "empty" ? <p className={styles.empty}>{t.noRelations}</p> : (
              <div className={styles.family} data-testid="lineage-text-view">
                <RelationList title={t.parents} items={profile.family.parents} locale={locale} profile={profile} testId="parent-relations" />
                <RelationList title={t.children} items={profile.family.children} locale={locale} profile={profile} testId="child-relations" />
                <RelationList title={t.siblings} items={profile.family.related.filter((item) => item.relation === "sibling")} locale={locale} profile={profile} />
                <RelationList title={t.grandparents} items={profile.family.related.filter((item) => item.relation === "grandparent")} locale={locale} profile={profile} />
              </div>
            )}
          </section>
        </div>

        <section id="footprint" className={`${shell} ${styles.section}`}>
          <div className={styles.visit}>
            <SectionHead title={t.footprint} intro={t.footprintIntro} state={profile.footprint.state} locale={locale} />
            <p className={styles.tiny}>{t.noCoordinates}</p>
            {profile.footprint.stops.length ? (
              <ol data-testid="footprint-text-view">
                {profile.footprint.stops.map((item) => (
                  <li key={item.id}>
                    <span className={styles.stopDate}>
                      {dateLabel(item.startDate, locale, item.startPrecision)} – {item.endDate ? dateLabel(item.endDate, locale, item.endPrecision ?? "day") : t.current}
                    </span>
                    <span>
                      <b>{item.label || t.unknown}</b>
                      <small>
                        {eventStatusLabel(item.status, locale)}
                        {item.lastVerifiedAt ? ` · ${t.verified}: ${item.lastVerifiedAt}` : null}
                        {" · "}{t.source}: <SourceAnchors sourceIds={item.sourceIds} profile={profile} locale={locale} />
                      </small>
                    </span>
                    {item.entityHref ? <Link href={item.entityHref as Route}>{t.openPlace}</Link> : <span />}
                  </li>
                ))}
              </ol>
            ) : <p className={styles.empty}>{t.noFootprint}</p>}
          </div>
        </section>

        <section id="media" className={`${shell} ${styles.section}`}>
          <SectionHead title={t.media} locale={locale} />
          {profile.media.state === "gallery" ? <TrustedProfileMediaGallery locale={locale} media={profile.media} /> : null}
          {profile.media.state === "no_licensed_media" ? (
            <div className={styles.callout} data-testid="media-empty-state">
              <strong>{t.noMedia}</strong>
              <p>{t.noMediaBody}</p>
            </div>
          ) : null}
          {profile.media.state === "source_link_only" ? (
            <div className={styles.callout} data-testid="media-source-link-state">
              <strong>{t.sourceMedia}</strong>
              <p>{t.sourceMediaBody}</p>
              {mediaSources.map((source) => (
                <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                  {t.sourceMediaAction}<ExternalLink aria-hidden="true" />
                </a>
              ))}
            </div>
          ) : null}
          {profile.media.state === "unavailable" ? <p className={styles.empty}>{t.mediaUnavailable}</p> : null}
        </section>

        <section id="sources" className={`${shell} ${styles.section}`}>
          <SectionHead title={t.sources} intro={t.sourcesIntro} locale={locale} />
          <ul className={styles.sources} data-testid="evidence-list">
            {profile.sources.map((source) => (
              <li key={source.id}>
                <article id={source.id}>
                  <p className={styles.tiny}>
                    {source.publisher} · {source.accessState === "accessible" ? t.accessible : source.accessState === "changed" ? t.changed : source.accessState === "restricted" ? t.restricted : t.unavailable}
                  </p>
                  <h3>{source.title}</h3>
                  <p className={styles.tiny}>
                    {t.published}: {source.publishedAt ? dateLabel(source.publishedAt, locale) : t.sourceDateUnavailable} · {t.verified}: {source.lastVerifiedAt}
                  </p>
                  <p className={styles.tiny}>{source.language} · {source.rawAccessState}</p>
                  <a href={source.url} target="_blank" rel="noreferrer">{t.source}<ExternalLink aria-hidden="true" /></a>
                </article>
              </li>
            ))}
          </ul>
          <div className={styles.identity}>
            <h3>{t.aliases}</h3>
            <p className={styles.tiny}>{t.stableIdentity}: {profile.stableId}</p>
            <ul aria-label={t.aliases}>
              {profile.identityReferences.map((reference) => (
                <li key={`${reference.kind}-${reference.value}`}>
                  <b>{reference.value}</b>
                  <small>{t.source}: {sourceNames(reference.sourceIds, profile) || t.noReviewedSource}</small>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="revisions" className={`${shell} ${styles.section}`}>
          <div className={`${styles.box} ${styles.soft}`} data-testid="revision-summary">
            <SectionHead
              title={t.revisions}
              state={profile.revision.state === "reviewed" ? "complete" : profile.revision.state === "partial" ? "partial" : "unavailable"}
              locale={locale}
            />
            <p className={styles.story}>
              {profile.revision.summary ?? (profile.revision.state === "partial" ? t.revisionPartial : t.revisionUnavailable)}
            </p>
            <dl className={styles.versions}>
              <div><dt>{t.dataVersion}</dt><dd>{profile.revision.dataVersion ?? t.unknown}</dd></div>
              <div><dt>{t.schema}</dt><dd>{profile.revision.publicSchemaVersion ?? t.unknown}</dd></div>
            </dl>
          </div>
          {deliveryIsLive ? <div className={styles.notice}>{deliveryNotice}</div> : null}
        </section>
      </main>
    </>
  );
}
