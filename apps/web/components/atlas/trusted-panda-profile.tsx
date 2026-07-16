import type { Route } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { siteShellClassName } from "@/components/site/site-header";
import { TrustedProfileFavorite } from "@/components/atlas/trusted-profile-favorite";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import type { PublicContentEnvelope, PublicProfileRecord } from "@/features/public-content/public-release";
import type {
  TrustedProfileFactViewModel,
  TrustedProfilePageViewModel,
} from "@/features/profile/profile-page-view-model";
import type { PandaDetail, PandaLineageResponse } from "@/lib/types";

export type PublicProfileLocale = "zh" | "en";

interface TrustedPandaProfileProps {
  locale: PublicProfileLocale;
  panda: PandaDetail;
  lineage: PandaLineageResponse;
  profile: TrustedProfilePageViewModel;
  envelope: PublicContentEnvelope<PublicProfileRecord>;
}

const SMITHSONIAN_ID = "afb0f227-dd5e-5076-88e3-74e9807a6049";

const copy = {
  zh: {
    archive: "可信公开档案",
    complete: "完整档案",
    basic: "基础资料",
    organizing: "资料整理中",
    aliases: "名称与检索线索",
    stableIdentity: "稳定身份",
    lifeStatus: "生命状态",
    birth: "出生日期",
    sex: "性别",
    female: "雌性",
    male: "雄性",
    alive: "存活",
    deceased: "已死亡",
    unknown: "暂无已审核记录",
    conclusionStatus: "结论状态",
    precision: "精度",
    confirmed: "已确认",
    provisional: "暂定",
    disputedConclusion: "有争议",
    superseded: "已取代",
    precisionDay: "日",
    precisionCountry: "国家级",
    precisionCategorical: "分类值",
    precisionUnknown: "未声明",
    missingTranslation: "当前语言名称尚未审核，保留原文名称。",
    place: "当前经核实地点",
    parents: "亲本",
    noParents: "暂无已审核亲本结论",
    verified: "最后核实",
    nav: [
      ["时间线", "timeline"],
      ["家族", "family"],
      ["足迹", "footprint"],
      ["影像", "media"],
      ["资料依据", "evidence"],
    ],
    timeline: "已审核时间线",
    timelineIntro: "发生日期与来源发布日期分开呈现。宣布迁移不会被写成已经发生。",
    announced: "已宣布",
    completed: "已完成",
    cancelled: "已取消",
    disputed: "有争议",
    residency: "居住记录",
    transfer: "迁移事件",
    family: "家族关系",
    familyIntro: "关系图与下方有序文本使用同一组已审核亲本关系。",
    children: "子女",
    footprint: "迁移足迹",
    footprintIntro: "当前资料只支持国家级位置，因此不推测或展示更精确地点。",
    noCoordinates: "公开记录没有足够精度用于地理地图。这里采用不带坐标的路线示意。",
    current: "当前记录",
    source: "来源",
    noReviewedSource: "暂无已审核来源结论",
    sourcePublished: "来源发布日期",
    sourceDateUnavailable: "来源发布日期未提供",
    media: "影像与许可",
    noMedia: "暂无可公开授权影像",
    noMediaBody: "档案明确记录为无已授权媒体。页面不会用来源不明的图片替代。",
    sourceMedia: "仅提供来源媒体链接",
    sourceMediaBody: "来源页面可供查阅，但其影像未导入图鉴，也不在本站重新授权。",
    sourceMediaAction: "前往来源页面",
    evidence: "资料依据",
    evidenceIntro: "每条关键结论只连接公开来源元数据，不公开内部审核材料。",
    published: "来源发布日期",
    related: "继续探索",
    revision: "档案版本与修订",
    schema: "Public Schema",
    language: "English",
    back: "返回熊猫图鉴",
    smithsonian: "史密森国家动物园",
    china: "中国（国家级记录）",
    openProfile: "在谱系中查看",
  },
  en: {
    archive: "Trusted public archive",
    complete: "Complete profile",
    basic: "Basic record",
    organizing: "Record in progress",
    aliases: "Names and search references",
    stableIdentity: "Stable identity",
    lifeStatus: "Life status",
    birth: "Birth date",
    sex: "Sex",
    female: "Female",
    male: "Male",
    alive: "Alive",
    deceased: "Deceased",
    unknown: "No reviewed record",
    conclusionStatus: "Conclusion status",
    precision: "Precision",
    confirmed: "Confirmed",
    provisional: "Provisional",
    disputedConclusion: "Disputed",
    superseded: "Superseded",
    precisionDay: "Day",
    precisionCountry: "Country-level",
    precisionCategorical: "Categorical",
    precisionUnknown: "Not stated",
    missingTranslation: "The English name has not been reviewed; the original-language name is retained.",
    place: "Current verified place",
    parents: "Parents",
    noParents: "No reviewed parent conclusion",
    verified: "Last verified",
    nav: [
      ["Timeline", "timeline"],
      ["Family", "family"],
      ["Footprint", "footprint"],
      ["Media", "media"],
      ["Evidence", "evidence"],
    ],
    timeline: "Reviewed timeline",
    timelineIntro: "Event dates and source publication dates stay distinct. Announcements are not presented as completed moves.",
    announced: "Announced",
    completed: "Completed",
    cancelled: "Cancelled",
    disputed: "Disputed",
    residency: "Residency",
    transfer: "Transfer event",
    family: "Family",
    familyIntro: "The relationship view and ordered text below use the same reviewed parentage records.",
    children: "Children",
    footprint: "Migration footprint",
    footprintIntro: "The current record supports country-level precision only. No more precise place is inferred or displayed.",
    noCoordinates: "The public record is not precise enough for a geographic map. This is a coordinate-free route diagram.",
    current: "Current record",
    source: "Source",
    noReviewedSource: "No reviewed source conclusion",
    sourcePublished: "Source published",
    sourceDateUnavailable: "Source publication date unavailable",
    media: "Media and licensing",
    noMedia: "No licensed public media",
    noMediaBody: "The record explicitly states that no licensed media is available. Unverified imagery is not substituted.",
    sourceMedia: "Source-linked media only",
    sourceMediaBody: "The source page may be consulted, but its media is not imported or relicensed by Panda Atlas.",
    sourceMediaAction: "Open source page",
    evidence: "Evidence",
    evidenceIntro: "Key conclusions link only to public source metadata. Internal review material remains private.",
    published: "Source published",
    related: "Continue exploring",
    revision: "Profile version and revision",
    schema: "Public Schema",
    language: "中文",
    back: "Back to panda atlas",
    smithsonian: "Smithsonian's National Zoo",
    china: "China (country-level record)",
    openProfile: "View in lineage",
  },
} as const;

function localizedSummary(panda: PandaDetail, locale: PublicProfileLocale): string {
  const key = locale === "zh" ? "zh-CN" : "en";
  return panda.localized_content.find((item) => item.locale === key)?.summary
    ?? copy[locale].unknown;
}

function archiveLabel(panda: PandaDetail, locale: PublicProfileLocale): string {
  if (panda.record_tier === "complete_first_pass") return copy[locale].complete;
  if (panda.record_tier === "identity_first_pass") return copy[locale].basic;
  return copy[locale].organizing;
}

function dateLabel(value: string | null, locale: PublicProfileLocale): string {
  if (!value) return copy[locale].unknown;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function placeLabel(facilityId: string | null, coarse: string | null, locale: PublicProfileLocale): string {
  if (facilityId === SMITHSONIAN_ID) return copy[locale].smithsonian;
  if (coarse === "China") return copy[locale].china;
  return coarse ?? copy[locale].unknown;
}

function sourceNames(sourceIds: string[], panda: PandaDetail): string {
  return sourceIds
    .map((sourceId) => panda.sources.find((source) => source.id === sourceId)?.publisher ?? sourceId)
    .join(", ");
}

function eventStatusLabel(status: PandaDetail["events"][number]["event_status"], locale: PublicProfileLocale): string {
  const t = copy[locale];
  switch (status) {
    case "announced": return t.announced;
    case "completed": return t.completed;
    case "cancelled": return t.cancelled;
    case "disputed": return t.disputed;
  }
}

function conclusionStatusLabel(
  status: TrustedProfileFactViewModel["status"],
  locale: PublicProfileLocale,
): string {
  const t = copy[locale];
  switch (status) {
    case "confirmed": return t.confirmed;
    case "provisional": return t.provisional;
    case "disputed": return t.disputedConclusion;
    case "superseded": return t.superseded;
    case "unknown": return t.unknown;
  }
}

function precisionLabel(
  precision: TrustedProfileFactViewModel["precision"],
  locale: PublicProfileLocale,
): string {
  const t = copy[locale];
  switch (precision) {
    case "day": return t.precisionDay;
    case "country": return t.precisionCountry;
    case "categorical": return t.precisionCategorical;
    case "unknown": return t.precisionUnknown;
  }
}

function FactProvenance({
  fact,
  locale,
  panda,
}: {
  fact: TrustedProfileFactViewModel;
  locale: PublicProfileLocale;
  panda: PandaDetail;
}) {
  const t = copy[locale];
  const colon = locale === "zh" ? "：" : ": ";
  return (
    <dd className="mt-1 text-xs leading-5 text-[var(--muted)]">
      {t.conclusionStatus}{colon}{conclusionStatusLabel(fact.status, locale)} | {t.precision}{colon}{precisionLabel(fact.precision, locale)}
      {fact.sourceIds.length ? (
        <> | {t.source}{colon}{fact.sourceIds.map((sourceId, index) => (
          <span key={sourceId}>{index ? ", " : ""}<a href={`#${sourceId}`} className="font-semibold text-[var(--accent)] hover:underline">{sourceNames([sourceId], panda)}</a></span>
        ))}</>
      ) : <> | {t.noReviewedSource}</>}
      {fact.lastVerifiedAt ? <> | {t.verified}{locale === "zh" ? "：" : ": "}{fact.lastVerifiedAt}</> : null}
    </dd>
  );
}

export function TrustedPandaProfile({ locale, panda, lineage, profile, envelope }: TrustedPandaProfileProps) {
  const t = copy[locale];
  const otherLocale = locale === "zh" ? "en" : "zh";
  const name = profile.displayName;
  const pinyin = panda.identity?.names.find((item) => item.language === "pinyin")?.value;
  const aliases = [
    ...(panda.identity?.aliases.map((item) => item.value) ?? []),
    ...(panda.identity?.legacy_slugs.map((item) => item.value) ?? []),
    ...(panda.identity?.external_identifiers.map((item) => `${item.system}: ${item.value}`) ?? []),
  ];
  const factByField = new Map(profile.facts.map((item) => [item.field, item]));
  const lifeStatusFact = factByField.get("life_status");
  const birthFact = factByField.get("birth_date");
  const sexFact = factByField.get("sex");
  const placeFact = factByField.get("current_coarse_location");
  if (!lifeStatusFact || !birthFact || !sexFact || !placeFact) {
    throw new Error("Trusted profile view model is missing an above-the-fold fact.");
  }
  const parents = lineage.edges
    .filter((edge) => edge.child_id === panda.id)
    .map((edge) => lineage.nodes.find((node) => node.id === edge.parent_id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const children = lineage.edges
    .filter((edge) => edge.parent_id === panda.id)
    .map((edge) => lineage.nodes.find((node) => node.id === edge.child_id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const relatedIds = new Set(
    lineage.relationships
      .filter((relationship) => relationship.subject_id === panda.id)
      .map((relationship) => relationship.related_id),
  );
  const childIds = new Set(
    lineage.edges
      .filter((edge) => edge.parent_id === panda.id)
      .map((edge) => edge.child_id),
  );
  for (const edge of lineage.edges) {
    if (childIds.has(edge.child_id) && edge.parent_id !== panda.id) {
      relatedIds.add(edge.parent_id);
    }
  }
  const related = lineage.nodes.filter((node) => relatedIds.has(node.id));
  const footprintStops = panda.residencies.map((item) => ({
    ...item,
    label: placeLabel(item.facility_id, item.coarse_location, locale),
  }));
  const timeline = [
    ...panda.residencies.map((item) => ({
      id: item.id,
      date: item.start_date,
      type: t.residency,
      title: placeLabel(item.facility_id, item.coarse_location, locale),
      detail: item.end_date
        ? `${dateLabel(item.start_date, locale)} - ${dateLabel(item.end_date, locale)}`
        : `${dateLabel(item.start_date, locale)} - ${t.current}`,
      sourceIds: item.source_ids,
    })),
    ...panda.events.map((item) => ({
      id: item.id,
      date: item.event_date,
      type: t.transfer,
      title: eventStatusLabel(item.event_status, locale),
      detail: `${placeLabel(item.from_facility_id, item.from_coarse_location, locale)} → ${placeLabel(item.to_facility_id, item.to_coarse_location, locale)}`,
      sourceIds: item.source_ids,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date));
  const revisionSummary = panda.public_revision?.summaries.find(
    (item) => item.locale === (locale === "zh" ? "zh-CN" : "en"),
  )?.summary;

  return (
    <>
      <GlobalNavigation locale={locale} active="profile" alternatePath={profile.alternateLanguageHref} />
      <main id="main-content" lang={locale === "zh" ? "zh-CN" : "en"} className="trusted-profile-theme bg-[var(--bg)] pb-20 text-[var(--fg)]" data-testid="trusted-panda-profile">
        <section className={`${publicShellClassName} pt-6`}>
          <PublicDeliveryNotice locale={locale} release={envelope.release} delivery={envelope.delivery} coverage={envelope.coverage} localeDelivery={envelope.locale} />
        </section>

      <section className={`${siteShellClassName} py-8 lg:py-12`}>
        <div data-testid="identity-first-card" className="grid gap-8 rounded-2xl border border-[rgba(47,92,69,0.1)] bg-[var(--card)] p-6 shadow-[0_24px_60px_rgba(30,44,31,0.08)] md:p-9 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link href={profile.atlasHref as Route} className="font-semibold text-[var(--accent)] hover:underline">{t.back}</Link>
              <span aria-hidden="true">/</span>
              <span>{archiveLabel(panda, locale)}</span>
            </div>
            <p className="mt-8 text-sm font-semibold text-[var(--accent)]">{t.archive}</p>
            <h1
              lang={profile.displayNameLanguage}
              className="mt-3 text-5xl leading-tight text-[var(--fg)] sm:text-6xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {name}
            </h1>
            {profile.displayNameTranslation === "missing" ? (
              <p className="mt-2 text-sm text-[var(--muted)]">{t.missingTranslation}</p>
            ) : null}
            <p className="mt-2 text-lg text-[var(--muted)]">
              {locale === "zh" ? panda.name_en : panda.name_zh}{pinyin ? ` / ${pinyin}` : ""}
            </p>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)]">{profile.summary ?? localizedSummary(panda, locale)}</p>

            <dl className="mt-8 grid gap-5 sm:grid-cols-2">
              <div data-testid="fact-life-status">
                <dt className="text-xs font-semibold text-[var(--muted)]">{t.lifeStatus}</dt><dd className="mt-2 text-lg font-semibold">{lifeStatusFact.value === "alive" ? t.alive : lifeStatusFact.value === "deceased" ? t.deceased : t.unknown}</dd><FactProvenance fact={lifeStatusFact} locale={locale} panda={panda} />
              </div>
              <div data-testid="fact-birth">
                <dt className="text-xs font-semibold text-[var(--muted)]">{t.birth}</dt><dd className="mt-2 text-lg font-semibold">{dateLabel(typeof birthFact.value === "string" ? birthFact.value : null, locale)}</dd><FactProvenance fact={birthFact} locale={locale} panda={panda} />
              </div>
              <div data-testid="fact-sex">
                <dt className="text-xs font-semibold text-[var(--muted)]">{t.sex}</dt><dd className="mt-2 text-lg font-semibold">{sexFact.value === "female" ? t.female : sexFact.value === "male" ? t.male : t.unknown}</dd><FactProvenance fact={sexFact} locale={locale} panda={panda} />
              </div>
              <div data-testid="fact-place">
                <dt className="text-xs font-semibold text-[var(--muted)]">{t.place}</dt><dd className="mt-2 text-lg font-semibold">{placeLabel(panda.current_place?.facility_id ?? null, typeof placeFact.value === "string" ? placeFact.value : null, locale)}</dd><FactProvenance fact={placeFact} locale={locale} panda={panda} />
              </div>
              <div data-testid="fact-parents"><dt className="text-xs font-semibold text-[var(--muted)]">{t.parents}</dt><dd className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-lg font-semibold">{parents.length ? parents.map((item) => <Link key={item.id} href={`/${locale}/atlas/${item.slug}`} className="text-[var(--accent)] hover:underline">{locale === "zh" ? item.name_zh : item.name_en ?? item.name_zh}</Link>) : t.noParents}</dd>{parents.length === 0 ? <dd className="mt-1 text-xs text-[var(--muted)]">{t.noReviewedSource}</dd> : null}</div>
            </dl>
          </div>

          <aside className="flex flex-col justify-between gap-8 rounded-2xl bg-[rgba(63,125,71,0.07)] p-6">
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">{archiveLabel(panda, locale)}</p>
              <dl className="mt-4 text-xs">
                <div>
                  <dt className="text-[var(--muted)]">{t.stableIdentity}</dt>
                  <dd className="mt-1 break-all font-semibold">{profile.stableId}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t.aliases}</p>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label={t.aliases}>
                {aliases.map((alias) => <li key={alias} className="rounded-lg border border-[rgba(47,92,69,0.12)] bg-[var(--card)] px-3 py-2 text-xs">{alias}</li>)}
              </ul>
            </div>
            <TrustedProfileFavorite slug={panda.slug} name={panda.name_zh} locale={locale} />
            <a href={profile.alternateLanguageHref} hrefLang={otherLocale === "zh" ? "zh-CN" : "en"} hidden className="text-sm font-semibold text-[var(--accent)] hover:underline">
              {t.language}
            </a>
          </aside>
        </div>
      </section>

      <nav aria-label={locale === "zh" ? "档案章节" : "Profile sections"} className="sticky top-[78px] z-20 border-y border-[rgba(47,92,69,0.08)] bg-[var(--card)]">
        <div className={`${siteShellClassName} flex gap-5 overflow-x-auto py-3 text-sm font-semibold`}>
          {t.nav.map(([label, id]) => <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-lg px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">{label}</a>)}
        </div>
      </nav>

      <section id="timeline" className={`${siteShellClassName} scroll-mt-36 py-14`}>
        <h2 className="text-3xl text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>{t.timeline}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t.timelineIntro}</p>
        <ol className="mt-8 grid gap-4" data-testid="timeline-list">
          {timeline.map((item) => (
            <li key={item.id} className="grid gap-3 rounded-xl border border-[rgba(47,92,69,0.09)] bg-[var(--card)] p-5 sm:grid-cols-[9rem_1fr]">
              <div><time className="font-semibold" dateTime={item.date}>{dateLabel(item.date, locale)}</time><p className="mt-1 text-xs text-[var(--accent)]">{item.type}</p></div>
              <div><p className="font-semibold">{item.title}</p><p className="mt-2 text-sm text-[var(--muted)]">{item.detail}</p><p className="mt-2 text-xs text-[var(--muted)]">{t.source}: {sourceNames(item.sourceIds, panda)}</p><ul className="mt-1 text-xs text-[var(--muted)]">{item.sourceIds.map((sourceId) => { const source = panda.sources.find((candidate) => candidate.id === sourceId); return <li key={sourceId}>{t.sourcePublished}: {source?.published_at ? dateLabel(source.published_at, locale) : t.sourceDateUnavailable}</li>; })}</ul></div>
            </li>
          ))}
        </ol>
      </section>

      <section id="family" className="scroll-mt-36 bg-[var(--card)] py-14">
        <div className={siteShellClassName}>
          <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.family}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t.familyIntro}</p>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div aria-hidden="true" className="rounded-2xl bg-[rgba(63,125,71,0.07)] p-6 text-center">
              <div className="mx-auto max-w-xs rounded-xl bg-[var(--accent)] px-5 py-4 font-semibold text-white">{name}</div>
              <div className="mx-auto h-8 w-px bg-[rgba(47,92,69,0.3)]" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children.map((child) => <div key={child.id} className="rounded-xl bg-[var(--card)] px-3 py-4 text-sm font-semibold">{locale === "zh" ? child.name_zh : child.name_en ?? child.name_zh}</div>)}</div>
            </div>
            <div data-testid="lineage-text-view">
              <h3 className="text-xl font-semibold">{t.children}</h3>
              <ol className="mt-4 grid gap-3">
                {children.map((child, index) => <li key={child.id} className="rounded-xl border border-[rgba(47,92,69,0.09)] p-4"><span className="mr-3 text-[var(--accent)]">{index + 1}.</span><Link href={`/${locale}/atlas/${child.slug}`} className="font-semibold text-[var(--accent)] hover:underline">{locale === "zh" ? child.name_zh : child.name_en ?? child.name_zh}</Link></li>)}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section id="footprint" className={`${siteShellClassName} scroll-mt-36 py-14`}>
        <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.footprint}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t.footprintIntro}</p>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div aria-hidden="true" className="rounded-2xl bg-[linear-gradient(135deg,rgba(63,125,71,0.11),rgba(63,125,71,0.03))] p-7">
            <p className="text-sm text-[var(--muted)]">{t.noCoordinates}</p>
            {footprintStops.length ? <div className="mt-8 grid items-start gap-2" style={{ gridTemplateColumns: `repeat(${footprintStops.length}, minmax(0, 1fr))` }}>{footprintStops.map((stop, index) => <div key={stop.id} className="relative text-center"><div className="flex items-center"><span className={`h-px flex-1 ${index === 0 ? "bg-transparent" : "bg-[var(--accent)]"}`} /><span className="h-4 w-4 shrink-0 rounded-full bg-[var(--accent)]" /><span className={`h-px flex-1 ${index === footprintStops.length - 1 ? "bg-transparent" : "bg-[var(--accent)]"}`} /></div><p className="mt-3 text-xs font-semibold sm:text-sm">{stop.label}</p></div>)}</div> : <p className="mt-6 text-sm font-semibold">{t.unknown}</p>}
          </div>
          <ol className="grid gap-3" data-testid="footprint-text-view">
            {footprintStops.map((item, index) => <li key={item.id} className="rounded-xl border border-[rgba(47,92,69,0.09)] bg-[var(--card)] p-5"><p className="font-semibold">{index + 1}. {item.label}</p><p className="mt-2 text-sm text-[var(--muted)]">{dateLabel(item.start_date, locale)} - {item.end_date ? dateLabel(item.end_date, locale) : t.current}</p><p className="mt-2 text-xs text-[var(--muted)]">{t.source}: {sourceNames(item.source_ids, panda)}</p></li>)}
          </ol>
        </div>
      </section>

      <section id="media" className="scroll-mt-36 bg-[var(--card)] py-14">
        <div className={siteShellClassName}>
          <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.media}</h2>
          {panda.media_release?.display_mode === "designed_empty_state" ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[rgba(47,92,69,0.22)] bg-[rgba(63,125,71,0.05)] p-8 sm:p-12" data-testid="media-empty-state">
              <p className="text-2xl font-semibold">{t.noMedia}</p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{t.noMediaBody}</p>
            </div>
          ) : null}
          {panda.media_release?.display_mode === "link_to_source" ? (
            <div className="mt-8 rounded-2xl border border-[rgba(47,92,69,0.12)] bg-[rgba(63,125,71,0.05)] p-8 sm:p-12" data-testid="media-source-link-state">
              <p className="text-2xl font-semibold">{t.sourceMedia}</p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{t.sourceMediaBody}</p>
              {panda.media_release.source_ids.map((sourceId) => {
                const source = panda.sources.find((item) => item.id === sourceId);
                return source ? <a key={sourceId} href={source.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline">{t.sourceMediaAction}<ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null;
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section id="evidence" className={`${siteShellClassName} scroll-mt-36 py-14`}>
        <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.evidence}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t.evidenceIntro}</p>
        <div className="mt-8 grid gap-4" data-testid="evidence-list">
          {panda.sources.map((source) => <article id={source.id} key={source.id} className="scroll-mt-36 rounded-xl border border-[rgba(47,92,69,0.09)] bg-[var(--card)] p-5"><p className="text-xs font-semibold text-[var(--accent)]">{source.publisher}</p><h3 className="mt-2 text-lg font-semibold">{source.title}</h3><p className="mt-2 text-xs text-[var(--muted)]">{t.published}: {source.published_at ? dateLabel(source.published_at, locale) : t.unknown} | {t.verified}: {source.last_verified_at}</p><a href={source.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline">{t.source}<ExternalLink className="h-4 w-4" aria-hidden="true" /></a></article>)}
        </div>
      </section>

      <section className="bg-[var(--card)] py-14">
        <div className={`${siteShellClassName} grid gap-8 lg:grid-cols-2`}>
          <div data-testid="revision-summary">
            <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.revision}</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{revisionSummary ?? t.unknown}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-[var(--muted)]">Data version</dt><dd className="mt-1 font-semibold">{panda.public_revision?.data_version ?? t.unknown}</dd></div><div><dt className="text-[var(--muted)]">{t.schema}</dt><dd className="mt-1 font-semibold">{panda.public_revision?.public_schema_version ?? t.unknown}</dd></div></dl>
          </div>
          <div>
            <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>{t.related}</h2>
            <div className="mt-5 grid gap-3">
              {related.map((item) => <Link key={item.id} href={`/${locale}/atlas/${item.slug}`} className="rounded-xl border border-[rgba(47,92,69,0.09)] p-5 transition-colors hover:bg-[rgba(63,125,71,0.05)]"><p className="text-lg font-semibold">{locale === "zh" ? item.name_zh : item.name_en ?? item.name_zh}</p><span className="mt-2 inline-block text-sm font-semibold text-[var(--accent)]">{t.openProfile}</span></Link>)}
            </div>
          </div>
        </div>
      </section>

      </main>
    </>
  );
}
