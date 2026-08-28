import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import { PandaCalendarPage } from "@/features/calendar/panda-calendar-page";
import {
  
  
  type PublicExperienceLocale,
  type PublicMomentOccurrence,
} from "@/features/public-experiences/data";
import { filterV2PublicMoments, loadV2PublicMomentDataset } from "@/features/public-content/public-v2";
import styles from "@/features/public-experiences/public-experiences.module.css";
import { parsePublicLocale } from "@/foundation/content/locales";


interface MomentsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const copy = {
  zh: {
    title: "熊猫时光",
    description: "用时光流或日历浏览已审核的熊猫事件与生日周年。",
    eyebrow: "Panda Almanac · 熊猫时光",
    dek: "同一份公开事件，两种阅读方式：沿时间线探索故事，或按月份查看熊猫世界发生了什么。",
    timelineView: "时光流",
    calendarView: "日历",
    sourceEvents: "唯一来源事件",
    visible: "当前结果",
    release: "公开版本",
    filters: "筛选时光流",
    year: "年份",
    month: "月份",
    panda: "熊猫",
    type: "事件类型",
    sort: "顺序",
    anniversaries: "包括生日周年",
    apply: "应用筛选",
    all: "全部",
    ascending: "日期升序",
    descending: "日期降序",
    source: "来源事件",
    derived: "生日周年",
    noResults: "当前筛选没有公开事件",
    noResultsBody: "这不表示没有发生过事情，只表示当前公开版本在此范围内没有结果。",
    evidence: "证据与版本",
    sourceId: "来源事件 ID",
    participants: "相关熊猫",
    anniversaryNote: "由已确认出生事件计算，不增加新的来源事件。",
    footer: "时光流与日历读取同一不可变公开发布，不维护第二份日历数据。",
  },
  en: {
    title: "Panda Moments",
    description: "Browse reviewed panda events and birthday anniversaries as a timeline or calendar.",
    eyebrow: "Panda Almanac · Panda Moments",
    dek: "One public event set, two ways to explore it: follow stories through time or browse what happened month by month.",
    timelineView: "Timeline",
    calendarView: "Calendar",
    sourceEvents: "unique source events",
    visible: "visible results",
    release: "public release",
    filters: "Filter the timeline",
    year: "Year",
    month: "Month",
    panda: "Panda",
    type: "Event type",
    sort: "Order",
    anniversaries: "Include birthday anniversaries",
    apply: "Apply filters",
    all: "All",
    ascending: "Date ascending",
    descending: "Date descending",
    source: "Source event",
    derived: "Birthday anniversary",
    noResults: "No public moments match these filters",
    noResultsBody: "This does not prove inactivity; it only means the current public release has no result in this scope.",
    evidence: "Evidence and release",
    sourceId: "Source event ID",
    participants: "Pandas",
    anniversaryNote: "Calculated from a confirmed birth event without creating another source event.",
    footer: "Timeline and calendar read the same immutable public release; there is no second calendar dataset.",
  },
} as const;

const eventLabels = {
  zh: {
    birth: "出生",
    birth_anniversary: "生日周年",
    arrival: "抵达",
    transfer: "迁移",
    return: "返回",
    naming: "命名",
    public_debut: "公开亮相",
    selection: "入选",
    announcement: "公布",
    observation: "观察记录",
    death: "离世",
  },
  en: {
    birth: "Birth",
    birth_anniversary: "Birthday anniversary",
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

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function integer(value: string | undefined, minimum: number, maximum: number): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function eventLabel(locale: PublicExperienceLocale, type: string): string {
  return eventLabels[locale][type as keyof typeof eventLabels.zh] ?? type.replaceAll("_", " ");
}

function participantName(locale: PublicExperienceLocale, occurrence: PublicMomentOccurrence): string {
  return occurrence.participants
    .map((panda) => locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh)
    .join(locale === "zh" ? "、" : ", ");
}

export async function generateMetadata({ params }: Pick<MomentsPageProps, "params">): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  return { title: copy[locale].title, description: copy[locale].description };
}

export default async function MomentsPage({ params, searchParams }: MomentsPageProps) {
  const [{ locale: rawLocale }, rawSearch] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const view = one(rawSearch.view) === "calendar" ? "calendar" : "timeline";
  const year = integer(one(rawSearch.year), 1800, 2200);
  const month = integer(one(rawSearch.month), 1, 12);
  const panda = one(rawSearch.panda);
  const eventType = one(rawSearch.type);
  const includeAnniversaries = one(rawSearch.anniversaries) === "1";
  const sort = one(rawSearch.sort) === "date_desc" ? "date_desc" : "date_asc";
  const now = new Date();
  const calendarYear = year ?? now.getUTCFullYear();
  const calendarMonth = month ?? now.getUTCMonth() + 1;
  const momentDataset = await loadV2PublicMomentDataset();
  if (!momentDataset) notFound();

  const timelineItems = filterV2PublicMoments(momentDataset, { year, month, panda, eventType, includeAnniversaries, sort });
  const calendarItems = filterV2PublicMoments(momentDataset, {
    year: calendarYear,
    month: calendarMonth,
    includeAnniversaries: true,
    sort: "date_asc",
  });
  const visibleItems = view === "calendar" ? calendarItems : timelineItems;
  const sourceEventCount = new Set(
    visibleItems.filter((item) => item.occurrenceKind === "source_event").map((item) => item.sourceEventId),
  ).size;

  const alternateLocale = locale === "zh" ? "en" : "zh";
  const alternateQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearch)) {
    const selected = one(value);
    if (selected) alternateQuery.set(key, selected);
  }
  const alternatePath = `/${alternateLocale}/moments${alternateQuery.size ? `?${alternateQuery}` : ""}`;
  const t = copy[locale];

  return (
    <div className={styles.page}>
      <GlobalNavigation locale={locale} active="moments" alternatePath={alternatePath} />
      <main id="main-content">
        <div className={styles.shell}>
          <p className={styles.releaseNote}>
            {t.release}: {momentDataset.release.version} · Schema {"v2"}
          </p>

          <section className={styles.hero} aria-labelledby="moments-title">
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h1 className={styles.title} id="moments-title">{t.title}</h1>
            <p className={styles.dek}>{t.dek}</p>
            <nav className={styles.directory} aria-label={locale === "zh" ? "熊猫时光视图" : "Panda Moments views"}>
              <Link href={`/${locale}/moments` as Route} aria-current={view === "timeline" ? "page" : undefined}>{t.timelineView}</Link>
              <Link
                href={`/${locale}/moments?view=calendar&year=${calendarYear}&month=${calendarMonth}` as Route}
                aria-current={view === "calendar" ? "page" : undefined}
              >
                {t.calendarView}
              </Link>
            </nav>
            <div className={styles.heroStats} aria-label={locale === "zh" ? "结果摘要" : "Result summary"}>
              <div className={styles.stat}><strong>{sourceEventCount}</strong><span>{t.sourceEvents}</span></div>
              <div className={styles.stat}><strong>{visibleItems.length}</strong><span>{t.visible}</span></div>
              <div className={styles.stat}><strong>{visibleItems.filter((item) => item.occurrenceKind === "derived_anniversary").length}</strong><span>{t.derived}</span></div>
            </div>
          </section>

          {view === "calendar" ? (
            <PandaCalendarPage
              locale={locale}
              year={calendarYear}
              month={calendarMonth}
              moments={calendarItems}
              releaseId={momentDataset.release.version}
            />
          ) : (
            <>
              <section className={styles.section} id="filters" aria-labelledby="filters-title">
                <div className={styles.sectionHeader}>
                  <div><p className={styles.eyebrow}>01 · Query</p><h2 id="filters-title">{t.filters}</h2></div>
                  <p>{locale === "zh" ? "筛选条件进入 URL，可刷新和分享同一结果。" : "Filters live in the URL so the same result can be refreshed and shared."}</p>
                </div>
                <form className={styles.filters} method="get" action={`/${locale}/moments`}>
                  <input type="hidden" name="view" value="timeline" />
                  <div className={styles.field}><label htmlFor="year">{t.year}</label><input id="year" name="year" inputMode="numeric" defaultValue={year?.toString() ?? ""} placeholder="2026" /></div>
                  <div className={styles.field}><label htmlFor="month">{t.month}</label><select id="month" name="month" defaultValue={month?.toString() ?? ""}><option value="">{t.all}</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></div>
                  <div className={styles.field}><label htmlFor="panda">{t.panda}</label><select id="panda" name="panda" defaultValue={panda ?? ""}><option value="">{t.all}</option>{momentDataset.pandas.map((item) => <option key={item.id} value={item.slug}>{locale === "zh" ? item.name_zh : item.name_en ?? item.name_zh}</option>)}</select></div>
                  <div className={styles.field}><label htmlFor="type">{t.type}</label><select id="type" name="type" defaultValue={eventType ?? ""}><option value="">{t.all}</option>{Object.keys(eventLabels.zh).filter((value) => value !== "birth_anniversary").map((value) => <option key={value} value={value}>{eventLabel(locale, value)}</option>)}</select></div>
                  <div className={styles.field}><label htmlFor="sort">{t.sort}</label><select id="sort" name="sort" defaultValue={sort}><option value="date_asc">{t.ascending}</option><option value="date_desc">{t.descending}</option></select></div>
                  <div className={styles.field}><label htmlFor="anniversaries">{t.anniversaries}</label><select id="anniversaries" name="anniversaries" defaultValue={includeAnniversaries ? "1" : "0"}><option value="0">{locale === "zh" ? "不包括" : "Exclude"}</option><option value="1">{locale === "zh" ? "包括" : "Include"}</option></select></div>
                  <button className={styles.submit} type="submit">{t.apply}</button>
                </form>
                <div className={styles.legend}><span><i />{t.source}</span><span><i />{t.derived}</span></div>
              </section>

              <section className={styles.section} id="timeline" aria-labelledby="timeline-title">
                <div className={styles.sectionHeader}>
                  <div><p className={styles.eyebrow}>02 · Timeline</p><h2 id="timeline-title">{t.timelineView}</h2></div>
                  <p>{locale === "zh" ? "多人共享事件只出现一次；生日周年明确标为派生内容。" : "Shared events appear once; birthday anniversaries remain explicitly derived."}</p>
                </div>
                {timelineItems.length ? (
                  <ol className={styles.timeline}>
                    {timelineItems.map((item) => {
                      const derived = item.occurrenceKind === "derived_anniversary";
                      const people = participantName(locale, item);
                      return (
                        <li key={item.id} className={`${styles.moment} ${derived ? styles.derived : ""}`}>
                          <time className={styles.momentDate} dateTime={item.occurrenceDate}>{item.occurrenceDate}</time>
                          <article className={styles.momentCard}>
                            <h3>{eventLabel(locale, item.eventType)}{people ? ` · ${people}` : ""}</h3>
                            <p>{derived ? t.anniversaryNote : `${t.sourceId}: ${item.sourceEventId}`}</p>
                            <div className={styles.pills} aria-label={t.participants}>
                              {item.participants.map((participant) => (
                                <Link key={participant.id} className={styles.pill} href={`/${locale}/pandas/${participant.slug}` as Route}>{locale === "zh" ? participant.name_zh : participant.name_en ?? participant.name_zh}</Link>
                              ))}
                              <span className={`${styles.pill} ${styles.pillSecondary}`}>{derived ? t.derived : item.eventStatus}</span>
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ol>
                ) : <div className={styles.empty}><h3>{t.noResults}</h3><p>{t.noResultsBody}</p></div>}
              </section>

              <section className={styles.section} id="evidence" aria-labelledby="evidence-title">
                <div className={styles.sectionHeader}>
                  <div><p className={styles.eyebrow}>03 · Trust</p><h2 id="evidence-title">{t.evidence}</h2></div>
                  <p>{locale === "zh" ? "生日周年保留原始出生事件 ID，不创建新的来源或修订记录。" : "Birthday anniversaries retain their birth-event ID and create no new source or revision record."}</p>
                </div>
                <div className={styles.evidenceGrid}>
                  <details open><summary>{locale === "zh" ? "覆盖范围" : "Coverage"}</summary><dl><dt>{t.release}</dt><dd>{momentDataset.release.version}</dd><dt>Schema</dt><dd>{"v2"}</dd><dt>{t.sourceEvents}</dt><dd>{sourceEventCount}</dd><dt>{t.derived}</dt><dd>{timelineItems.filter((item) => item.occurrenceKind === "derived_anniversary").length}</dd></dl></details>
                  <details><summary>{locale === "zh" ? "继续探索" : "Continue exploring"}</summary><div className={styles.directory}><Link href={`/${locale}/pandas` as Route}>{locale === "zh" ? "熊猫" : "Pandas"}</Link><Link href={`/${locale}/families` as Route}>{locale === "zh" ? "家族" : "Families"}</Link></div></details>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      <footer className={`${styles.shell} ${styles.footer}`}>{t.footer}</footer>
    </div>
  );
}
