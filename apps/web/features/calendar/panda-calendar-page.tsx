import type { Route } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import type { PublicMomentOccurrence } from "@/features/public-experiences/data";
import type { PublicLocale } from "@/foundation/content/locales";

interface PandaCalendarPageProps {
  locale: PublicLocale;
  year: number;
  month: number;
  moments: PublicMomentOccurrence[];
  releaseId: string;
}

const copy = {
  zh: {
    eyebrow: "熊猫日历",
    title: "按月看看熊猫世界发生了什么。",
    body: "这里复用已发布事件和由出生事件派生的生日周年，不建立第二份日历数据。",
    prev: "上个月",
    next: "下个月",
    moments: "切换到时光流",
    release: "公开版本",
    empty: "这个月当前没有已发布事件或生日周年。",
    derived: "生日周年 · 由出生事件派生",
    source: "公开事件",
    participants: "相关熊猫",
  },
  en: {
    eyebrow: "Panda calendar",
    title: "See what is happening in the panda world, month by month.",
    body: "This view reuses published events and birthday anniversaries derived from birth events. It never creates a second calendar truth.",
    prev: "Previous month",
    next: "Next month",
    moments: "Switch to timeline",
    release: "Public release",
    empty: "There are no published events or birthday anniversaries in this month yet.",
    derived: "Birthday anniversary · derived from a birth event",
    source: "Published event",
    participants: "Pandas",
  },
} as const;

const eventLabels = {
  zh: {
    birth: "出生",
    birth_anniversary: "生日",
    arrival: "抵达",
    transfer: "迁移",
    return: "返回",
    naming: "命名",
    public_debut: "公开亮相",
    selection: "入选",
    announcement: "公告",
    observation: "观察",
    death: "离世",
  },
  en: {
    birth: "Birth",
    birth_anniversary: "Birthday",
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

function monthHref(locale: PublicLocale, year: number, month: number): string {
  const target = new Date(Date.UTC(year, month - 1, 1));
  return `/${locale}/moments?view=calendar&year=${target.getUTCFullYear()}&month=${target.getUTCMonth() + 1}`;
}

function monthLabel(locale: PublicLocale, year: number, month: number): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function dayLabel(locale: PublicLocale, value: string): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function eventLabel(locale: PublicLocale, eventType: string): string {
  const labels = eventLabels[locale] as Record<string, string>;
  return labels[eventType] ?? eventType.replaceAll("_", " ");
}

export function PandaCalendarPage({
  locale,
  year,
  month,
  moments,
  releaseId,
}: PandaCalendarPageProps) {
  const t = copy[locale];
  const grouped = new Map<string, PublicMomentOccurrence[]>();
  for (const moment of moments) {
    const items = grouped.get(moment.occurrenceDate) ?? [];
    items.push(moment);
    grouped.set(moment.occurrenceDate, items);
  }

  return (
    <div className="grid gap-9 py-10 sm:py-14">
      <header className="max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--pa-color-accent-border-14)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--accent)]">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />{t.eyebrow}
        </div>
        <h2 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
          {t.title}
        </h2>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">{t.body}</p>
      </header>

      <section className="rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-5 sm:p-7" aria-labelledby="calendar-month-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={monthHref(locale, year, month - 1) as Route}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--pa-color-accent-border-14)] px-4 py-3 font-semibold"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />{t.prev}
          </Link>
          <div className="text-center">
            <h2 id="calendar-month-heading" className="text-3xl font-semibold">{monthLabel(locale, year, month)}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">{t.release}: {releaseId}</p>
          </div>
          <Link
            href={monthHref(locale, year, month + 1) as Route}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--pa-color-accent-border-14)] px-4 py-3 font-semibold"
          >
            {t.next}<ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label={locale === "zh" ? "选择月份" : "Choose month"}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
            <Link
              key={value}
              href={`/${locale}/moments?view=calendar&year=${year}&month=${value}` as Route}
              aria-current={value === month ? "date" : undefined}
              className="grid h-11 min-w-11 place-items-center rounded-xl border border-[var(--pa-color-accent-border-10)] px-3 text-sm font-semibold aria-[current=date]:bg-[var(--accent)] aria-[current=date]:text-white"
            >
              {locale === "zh" ? `${value}月` : new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, value - 1, 1)))}
            </Link>
          ))}
        </div>
      </section>

      {grouped.size ? (
        <ol className="grid gap-5">
          {[...grouped.entries()].map(([date, items]) => (
            <li key={date} className="grid gap-4 rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:p-7">
              <time dateTime={date} className="text-lg font-semibold">{dayLabel(locale, date)}</time>
              <div className="grid gap-4">
                {items.map((item) => (
                  <article key={item.id} className="rounded-2xl bg-[var(--surface-muted)] p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{eventLabel(locale, item.eventType)}</h3>
                      <span className="rounded-full border border-[var(--pa-color-accent-border-14)] px-2 py-1 text-xs text-[var(--muted)]">
                        {item.occurrenceKind === "derived_anniversary" ? t.derived : t.source}
                      </span>
                    </div>
                    {item.participants.length ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-[var(--muted)]">{t.participants}:</span>
                        {item.participants.map((panda) => (
                          <Link key={panda.id} href={`/${locale}/pandas/${panda.slug}` as Route} className="font-semibold text-[var(--accent)] underline underline-offset-4">
                            {locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-[2rem] border border-dashed border-[var(--pa-color-accent-border-18)] p-7 text-[var(--muted)]">{t.empty}</p>
      )}

      <Link
        href={`/${locale}/moments?view=timeline&year=${year}&month=${month}&anniversaries=1` as Route}
        className="inline-flex min-h-12 items-center self-start justify-self-start rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
      >
        {t.moments}
      </Link>
    </div>
  );
}
