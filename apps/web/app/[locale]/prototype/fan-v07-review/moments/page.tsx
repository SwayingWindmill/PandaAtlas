/* eslint-disable @next/next/no-img-element -- recovered visual review uses explicitly isolated historical photo fixtures. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays } from "lucide-react";

import { listPublicMoments } from "@/features/public-experiences/data";
import { parsePublicLocale } from "@/foundation/content/locales";

import { reviewImage, reviewImageAlt, reviewName } from "../review-data";
import { ReviewShell } from "../review-shell";
import styles from "../review.module.css";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "ZhiPanda V0.7 moments review",
  robots: { index: false, follow: false },
};

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function eventLabel(value: string, zh: boolean): string {
  if (value === "birth_anniversary") return zh ? "生日纪念" : "Birthday anniversary";
  if (!zh) return value.replaceAll("_", " ");
  const labels: Record<string, string> = {
    birth: "出生",
    arrival: "抵达",
    transfer: "迁居",
    return: "返回",
    naming: "命名",
    public_debut: "公开亮相",
    selection: "选择",
    announcement: "公开消息",
    observation: "记录",
    death: "去世",
  };
  return labels[value] ?? value;
}

function reviewHref(locale: string, year: number, month: number | null): string {
  const params = new URLSearchParams({ year: String(year) });
  if (month) params.set("month", String(month));
  return `/${locale}/prototype/fan-v07-review/moments?${params}`;
}

export default async function FanV07ReviewMoments({ params, searchParams }: Props) {
  const [{ locale: rawLocale }, rawSearch] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";

  const rawEvents = listPublicMoments({ sort: "date_desc" });
  const availableYears = [...new Set(rawEvents.map((item) => Number(item.occurrenceDate.slice(0, 4))))]
    .filter(Number.isFinite)
    .sort((left, right) => right - left);
  const fallbackYear = availableYears[0] ?? 2026;
  const requestedYear = Number(one(rawSearch.year));
  const year = availableYears.includes(requestedYear) ? requestedYear : fallbackYear;
  const requestedMonth = Number(one(rawSearch.month));
  const month = requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : null;

  const moments = listPublicMoments({ year, month: month ?? undefined, includeAnniversaries: true, sort: "date_desc" }).slice(0, 30);
  const feature = moments.find((item) => item.participants.some((panda) => reviewImage(panda))) ?? moments[0] ?? null;
  const featurePanda = feature?.participants.find((panda) => reviewImage(panda)) ?? feature?.participants[0] ?? null;
  const monthCounts = Array.from({ length: 12 }, (_, index) => {
    const value = index + 1;
    return { month: value, count: listPublicMoments({ year, month: value, includeAnniversaries: true }).length };
  });

  return (
    <ReviewShell locale={locale} active="moments">
      <main className={styles.main}>
        <div className={styles.shell}>
          <section className={styles.momentsIntro}>
            <div>
              <span className={styles.sectionMeta}>MOMENTS</span>
              <h1 className={styles.display}>{zh ? "熊猫时光" : "Panda moments"}</h1>
              <p>{zh ? "V0.7 已经把熊猫事件从“数据库时间字段”转成可以按年份和月份逛的内容面：生日、出生、迁居、返回、命名与公开事件都在同一条时间轴里。" : "V0.7 turned event records into a browseable chronology: birthdays, births, moves, returns, naming, and public moments all live on one timeline."}</p>
            </div>
            <div className={styles.yearBadge}><strong>{year}</strong><span>{month ? (zh ? `${month} 月` : `Month ${month}`) : (zh ? "全年" : "Full year")}</span></div>
          </section>

          <nav className={styles.yearRail} aria-label={zh ? "年份" : "Years"}>
            {availableYears.slice(0, 8).map((value) => <Link key={value} href={reviewHref(locale, value, null) as Route} aria-current={value === year ? "page" : undefined}>{value}</Link>)}
          </nav>
          <nav className={styles.monthRail} aria-label={zh ? "月份" : "Months"}>
            <Link href={reviewHref(locale, year, null) as Route} aria-current={!month ? "page" : undefined}>{zh ? "全年" : "All"}</Link>
            {monthCounts.map((item) => (
              <Link key={item.month} href={reviewHref(locale, year, item.month) as Route} aria-current={month === item.month ? "page" : undefined}>
                <span>{String(item.month).padStart(2, "0")}</span><small>{item.count}</small>
              </Link>
            ))}
          </nav>

          {feature && featurePanda ? (
            <section className={styles.momentFeature}>
              <div className={styles.momentFeatureMedia}>{reviewImage(featurePanda) ? <img src={reviewImage(featurePanda) ?? ""} alt={reviewImageAlt(featurePanda, locale)} /> : <div className={styles.noPhoto}>{reviewName(featurePanda, locale).slice(0, 1)}</div>}</div>
              <div className={styles.momentFeatureCopy}>
                <time dateTime={feature.occurrenceDate}>{feature.occurrenceDate}</time>
                <h2>{eventLabel(feature.eventType, zh)}</h2>
                <strong>{feature.participants.map((panda) => reviewName(panda, locale)).join(" · ")}</strong>
                <p>{feature.fromCoarseLocation && feature.toCoarseLocation ? `${feature.fromCoarseLocation} → ${feature.toCoarseLocation}` : feature.toCoarseLocation ?? feature.fromCoarseLocation ?? (zh ? "公开记录" : "Published record")}</p>
                <Link className={styles.textLink} href={`/${locale}/pandas/${featurePanda.slug}` as Route}>{zh ? "查看熊猫档案" : "View panda profile"}<ArrowRight aria-hidden="true" /></Link>
              </div>
            </section>
          ) : null}

          <section className={styles.momentList}>
            <div className={styles.directoryHeader}>
              <div><span className={styles.sectionMeta}>TIMELINE</span><h2>{month ? (zh ? `${year} 年 ${month} 月` : `${month}/${year}`) : (zh ? `${year} 年事件` : `${year} events`)}</h2></div>
              <Link className={styles.rowAction} href={`/${locale}/moments?year=${year}${month ? `&month=${month}` : ""}` as Route}><CalendarDays aria-hidden="true" />{zh ? "打开正式日历与筛选" : "Open production calendar + filters"}</Link>
            </div>
            {moments.length ? moments.map((moment) => {
              const participant = moment.participants[0] ?? null;
              return (
                <article className={styles.momentRow} key={moment.id}>
                  <time dateTime={moment.occurrenceDate}>{moment.occurrenceDate}</time>
                  <strong>{eventLabel(moment.eventType, zh)}</strong>
                  <p>{moment.participants.length ? moment.participants.map((panda) => reviewName(panda, locale)).join(" · ") : (zh ? "熊猫公开事件" : "Published panda event")}</p>
                  <span>{moment.toCoarseLocation ?? moment.fromCoarseLocation ?? "—"}</span>
                  {participant ? <Link href={`/${locale}/pandas/${participant.slug}` as Route} aria-label={reviewName(participant, locale)}><ArrowRight aria-hidden="true" /></Link> : null}
                </article>
              );
            }) : <div className={styles.empty}>{zh ? "这个月份暂时没有公开事件。可以切换到全年或其他月份。" : "No published events are available for this month. Try the full year or another month."}</div>}
          </section>
        </div>
      </main>
    </ReviewShell>
  );
}
