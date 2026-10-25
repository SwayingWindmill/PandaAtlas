import type { Route } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PandaFavoriteControl } from "@/components/pandas/panda-favorite-control";
import { PandaSeenControl } from "@/components/pandas/panda-seen-control";
import { PublicPandaActivity } from "@/features/feed/public-panda-activity";
import type { ActivityPageData } from "@/features/feed/types";
import { ProfileVisitRecorder } from "@/features/preferences/profile-visit-recorder";
import { familyStoriesForPanda, localizedEditorial } from "@/features/public-experiences/stories";
import { TrustedProfileMediaGallery } from "@/features/profile/trusted-profile-media-gallery";
import { publicShellClassName } from "@/components/patterns/public-shell";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import { LicensedMediaFigure } from "@/components/patterns/licensed-media-figure";
import type { PublicContentEnvelope, PublicProfileRecord } from "@/features/public-content/public-release";
import { buildPandaStructuredData, serializeStructuredData } from "@/foundation/metadata/panda-structured-data";
import type { PandaListItem } from "@/lib/types";
import type {
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
    back: "全部熊猫",
    about: "简介",
    lifeStatus: "状态",
    birth: "出生",
    sex: "性别",
    place: "所在地",
    parents: "父母",
    alive: "在世",
    deceased: "已离世",
    female: "雌性",
    male: "雄性",
    unknown: "暂无记录",
    tentative: "待确认",
    provisional: "待确认",
    disputed: "有争议",
    superseded: "已更正",
    announced: "已宣布",
    cancelled: "已取消",
    timeline: "经历",
    current: "至今",
    noTimeline: "暂无经历记录",
    family: "家人",
    children: "子女",
    siblings: "兄弟姐妹",
    grandparents: "祖辈",
    noRelations: "暂无家人记录",
    footprint: "生活过的地方",
    noFootprint: "暂无居住记录",
    openPlace: "查看地点",
    media: "照片",
    noMedia: "暂无照片",
    sourceMedia: "照片可在来源网站查看",
    sourceMediaAction: "打开来源网站",
    moments: "熊猫时光",
    lineage: "家族谱系",
    explore: "继续探索",
  },
  en: {
    back: "All pandas",
    about: "About",
    lifeStatus: "Status",
    birth: "Born",
    sex: "Sex",
    place: "Lives at",
    parents: "Parents",
    alive: "Living",
    deceased: "Deceased",
    female: "Female",
    male: "Male",
    unknown: "Unknown",
    tentative: "Unconfirmed",
    provisional: "Unconfirmed",
    disputed: "Disputed",
    superseded: "Corrected",
    announced: "Announced",
    cancelled: "Cancelled",
    timeline: "Life story",
    current: "Present",
    noTimeline: "No life events yet",
    family: "Family",
    children: "Children",
    siblings: "Siblings",
    grandparents: "Grandparents",
    noRelations: "No family records yet",
    footprint: "Places lived",
    noFootprint: "No places recorded yet",
    openPlace: "View place",
    media: "Photos",
    noMedia: "No photos yet",
    sourceMedia: "Photos are available on the source website",
    sourceMediaAction: "Open source website",
    moments: "Panda Moments",
    lineage: "Family lineage",
    explore: "Continue exploring",
  },
} as const;

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
    day: precision === "day" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(date);
}

/** Settled records need no label; only open or contested ones say so. */
function pendingLabel(status: string, locale: PublicProfileLocale): string | null {
  const t = copy[locale];
  if (status === "tentative") return t.tentative;
  if (status === "provisional") return t.provisional;
  if (status === "disputed") return t.disputed;
  if (status === "superseded") return t.superseded;
  if (status === "announced") return t.announced;
  if (status === "cancelled") return t.cancelled;
  return null;
}

function eventKindLabel(
  kind: TrustedProfilePageViewModel["timeline"]["items"][number]["kind"],
  locale: PublicProfileLocale,
): string {
  const labels = {
    zh: {
      residency: "居住",
      birth: "出生",
      arrival: "抵达",
      transfer: "迁居",
      return: "回国",
      naming: "命名",
      public_debut: "首次亮相",
      selection: "入选",
      announcement: "公告",
      observation: "观察",
      death: "离世",
    },
    en: {
      residency: "Lived at",
      birth: "Birth",
      arrival: "Arrival",
      transfer: "Move",
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

function Pending({ status, locale }: { status: string; locale: PublicProfileLocale }) {
  const label = pendingLabel(status, locale);
  return label ? <span className={styles.pending}>{label}</span> : null;
}

function RelationList({
  title,
  items,
  locale,
  testId,
}: {
  title: string;
  items: TrustedProfileRelationViewModel[];
  locale: PublicProfileLocale;
  testId?: string;
}) {
  if (!items.length) return null;
  return (
    <div data-testid={testId}>
      <h3 className={styles.kinTitle}>{title}</h3>
      <ol className={styles.kin}>
        {items.map((item) => (
          <li key={`${item.relation}-${item.id}`}>
            <i aria-hidden="true">{Array.from(item.name)[0]}</i>
            {item.href
              ? <Link href={item.href as Route} lang={item.nameLanguage}>{item.name}</Link>
              : <b lang={item.nameLanguage}>{item.name}</b>}
            <Pending status={item.status} locale={locale} />
          </li>
        ))}
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
  const familyStories = familyStoriesForPanda(profile.stableId);
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
  // A stale, partial or untranslated delivery is a warning the reader needs before the facts;
  // live, reviewed data needs no notice at all.
  const deliveryNotice = (
    <PublicDeliveryNotice
      locale={locale}
      release={envelope.release}
      delivery={envelope.delivery}
      coverage={envelope.coverage}
      localeDelivery={envelope.locale}
    />
  );
  const deliveryIsLive = envelope.delivery.state === "live" && envelope.locale.translation === "reviewed";
  const altNames = [profile.alternateName, profile.pinyin].filter(
    (name, index, names): name is string => Boolean(name) && name !== profile.displayName && names.indexOf(name) === index,
  );
  // The hero already shows the summary; the About section only adds a longer reviewed story.
  const storyParagraphs = profile.story.state === "reviewed"
    ? profile.story.paragraphs.filter((paragraph) => paragraph !== profile.summary)
    : [];

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
              fallbackBody=""
              priority
              testId="profile-hero-media"
            />
          </div>
          <div className={styles.heroCopy}>
            <h1 lang={profile.displayNameLanguage}>{profile.displayName}</h1>
            {altNames.length ? (
              <p className={styles.alt}>{altNames.map((name) => <span key={name}>{name}</span>)}</p>
            ) : null}
            {profile.summary ? <p className={styles.bio}>{profile.summary}</p> : null}

            <dl className={styles.facts}>
              {([
                ["fact-life-status", t.lifeStatus, lifeStatusFact],
                ["fact-birth", t.birth, birthFact],
                ["fact-sex", t.sex, sexFact],
                ["fact-place", t.place, placeFact],
              ] as const).map(([testId, label, fact]) => (
                <div key={testId} data-testid={testId}>
                  <dt>{label}</dt>
                  <dd>{factValue(fact, profile, locale)}<Pending status={fact.status} locale={locale} /></dd>
                </div>
              ))}
              <div data-testid="fact-parents">
                <dt>{t.parents}</dt>
                <dd className={styles.names}>
                  {parents.length ? parents.map((item) => (
                    <span key={item.id}>
                      {item.href
                        ? <Link href={item.href as Route} lang={item.nameLanguage}>{item.name}</Link>
                        : <span lang={item.nameLanguage}>{item.name}</span>}
                    </span>
                  )) : t.unknown}
                </dd>
              </div>
            </dl>

            <div className={styles.actions}>
              <PandaFavoriteControl stableId={profile.stableId} slug={profile.canonicalSlug} name={profile.displayName} locale={locale} />
              <PandaSeenControl stableId={profile.stableId} slug={profile.canonicalSlug} name={profile.displayName} locale={locale} />
            </div>

            <ul className={styles.explore} aria-label={t.explore}>
              <li><Link href={`/${locale}/moments?panda=${profile.canonicalSlug}` as Route} aria-label={locale === "zh" ? "查看熊猫时光" : "View Panda Moments"}>{t.moments}</Link></li>
              <li><Link href={`/${locale}/families?view=lineage&focus=${profile.canonicalSlug}` as Route} aria-label={locale === "zh" ? "查看家族谱系" : "View family lineage"}>{t.lineage}</Link></li>
              {familyStories.map((story) => (
                <li key={story.id}>
                  <Link href={`/${locale}/families/${story.slug}` as Route}>{localizedEditorial(story.localized_content, locale).title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

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

        {storyParagraphs.length ? (
          <section id="story" className={`${shell} ${styles.section}`} data-testid="reviewed-story">
            <h2 className={styles.sectionTitle}>{t.about}</h2>
            <div className={styles.story}>
              {storyParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ) : null}

        <div className={`${shell} ${styles.section} ${styles.two}`}>
          <section id="timeline" aria-labelledby="profile-timeline">
            <h2 id="profile-timeline" className={styles.sectionTitle}>{t.timeline}</h2>
            {profile.timeline.items.length ? (
              <ol className={styles.timeline} data-testid="timeline-list">
                {profile.timeline.items.map((item) => (
                  <li key={item.id} data-current={item.kind === "residency" && !item.endDate ? "" : undefined}>
                    <p className={styles.when}>
                      <time dateTime={item.date}>{dateLabel(item.date, locale, item.datePrecision)}</time>
                      {item.endDate ? <> – {dateLabel(item.endDate, locale, item.endPrecision ?? "day")}</> : null}
                    </p>
                    <p className={styles.what}>
                      <span>{eventKindLabel(item.kind, locale)}</span>
                      {item.fromLabel && item.toLabel ? `${item.fromLabel} → ${item.toLabel}` : item.toLabel || item.fromLabel || null}
                      <Pending status={item.status} locale={locale} />
                    </p>
                  </li>
                ))}
              </ol>
            ) : <p className={styles.empty} data-testid="timeline-empty-state">{t.noTimeline}</p>}
          </section>

          <section id="family" aria-labelledby="profile-family">
            <h2 id="profile-family" className={styles.sectionTitle}>{t.family}</h2>
            {profile.family.state === "empty" ? <p className={styles.empty}>{t.noRelations}</p> : (
              <div className={styles.family} data-testid="lineage-text-view">
                <RelationList title={t.parents} items={profile.family.parents} locale={locale} testId="parent-relations" />
                <RelationList title={t.children} items={profile.family.children} locale={locale} testId="child-relations" />
                <RelationList title={t.siblings} items={profile.family.related.filter((item) => item.relation === "sibling")} locale={locale} />
                <RelationList title={t.grandparents} items={profile.family.related.filter((item) => item.relation === "grandparent")} locale={locale} />
              </div>
            )}
          </section>
        </div>

        <section id="footprint" className={`${shell} ${styles.section}`} aria-labelledby="profile-footprint">
          <h2 id="profile-footprint" className={styles.sectionTitle}>{t.footprint}</h2>
          {profile.footprint.stops.length ? (
            <ol className={styles.stops} data-testid="footprint-text-view">
              {profile.footprint.stops.map((item) => (
                <li key={item.id}>
                  <span className={styles.stopDate}>
                    {dateLabel(item.startDate, locale, item.startPrecision)} – {item.endDate ? dateLabel(item.endDate, locale, item.endPrecision ?? "day") : t.current}
                  </span>
                  <b>{item.label || t.unknown}<Pending status={item.status} locale={locale} /></b>
                  {item.entityHref ? <Link href={item.entityHref as Route}>{t.openPlace}</Link> : <span />}
                </li>
              ))}
            </ol>
          ) : <p className={styles.empty}>{t.noFootprint}</p>}
        </section>

        {profile.media.state === "unavailable" ? null : (
          <section id="media" className={`${shell} ${styles.section}`} aria-labelledby="profile-media">
            <h2 id="profile-media" className={styles.sectionTitle}>{t.media}</h2>
            {profile.media.state === "gallery" ? <TrustedProfileMediaGallery locale={locale} media={profile.media} /> : null}
            {profile.media.state === "no_licensed_media" ? (
              <p className={styles.empty} data-testid="media-empty-state">{t.noMedia}</p>
            ) : null}
            {profile.media.state === "source_link_only" ? (
              <div className={styles.empty} data-testid="media-source-link-state">
                <p>{t.sourceMedia}</p>
                {mediaSources.map((source) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                    {t.sourceMediaAction}<ExternalLink aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {profile.revision.summary ? (
          <footer className={`${shell} ${styles.footnote}`} data-testid="revision-summary">
            <p>{profile.revision.summary}</p>
          </footer>
        ) : null}
      </main>
    </>
  );
}
