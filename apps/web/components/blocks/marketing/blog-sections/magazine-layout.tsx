/* eslint-disable @next/next/no-img-element -- review media is intentionally rendered directly. */

/**
 * Registry source: Shadcn UI Blocks / marketing blog sections / magazine layout.
 * The editorial two-column hierarchy is retained; demo marketing content has been
 * replaced with PandaAtlas Home v0.9 data.
 */

import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { HomeV09ViewModel } from "@/features/home/home-v09-view-model";

export default function TodayMagazine({
  locale,
  today,
}: {
  locale: "zh" | "en";
  today: HomeV09ViewModel["today"];
}) {
  const zh = locale === "zh";
  const { lead, secondary } = today;

  return (
    <section
      className="mx-auto w-full max-w-[92rem] border-b border-[var(--pa-color-line)] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
      aria-labelledby="today-in-panda-atlas"
    >
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h1
          id="today-in-panda-atlas"
          className="text-2xl font-semibold tracking-[-0.035em] text-[var(--pa-color-ink)] sm:text-3xl"
        >
          {zh ? "今日 · 熊猫世界" : "Today in PandaAtlas"}
        </h1>
        <span className="hidden text-xs font-medium tracking-[0.08em] text-[var(--pa-color-ink-muted)] sm:inline">
          {zh ? "公开档案 · 持续更新" : "PUBLIC ARCHIVE · CONTINUOUSLY UPDATED"}
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-12 lg:border-t lg:border-[var(--pa-color-line)]">
        <article className="lg:col-span-8 lg:border-r lg:border-[var(--pa-color-line)] lg:pr-7 lg:pt-7">
          <Link href={lead.href as Route} className="group block">
            {lead.media ? (
              <div className="overflow-hidden bg-[var(--pa-color-surface-subtle)]">
                <img
                  src={lead.media.src}
                  alt={lead.media.alt}
                  className="aspect-[16/9] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.012] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="grid aspect-[16/9] place-items-center border border-[var(--pa-color-line)] bg-[var(--pa-color-surface-subtle)]">
                <span className="text-sm text-[var(--pa-color-ink-muted)]">
                  {zh ? "当前公开档案暂无可展示影像" : "No display media in the current public record"}
                </span>
              </div>
            )}

            <div className="grid gap-3 border-b border-[var(--pa-color-line)] py-5 sm:grid-cols-[1fr_auto] sm:items-end lg:border-b-0">
              <div className="max-w-3xl">
                <div className="mb-2 flex items-center gap-3 text-xs text-[var(--pa-color-ink-muted)]">
                  <span>{lead.label}</span>
                  {lead.dateLabel ? <time>{lead.dateLabel}</time> : null}
                </div>
                <h2 className="text-balance text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-[var(--pa-color-ink)] sm:text-4xl xl:text-5xl">
                  {lead.title}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--pa-color-ink-muted)]">
                  {lead.deck}
                </p>
              </div>
              <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--pa-color-ink)]">
                {zh ? "查看档案" : "Open profile"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </article>

        <aside className="divide-y divide-[var(--pa-color-line)] border-t border-[var(--pa-color-line)] lg:col-span-4 lg:border-t-0 lg:pl-7 lg:pt-7">
          {secondary.map((item) => (
            <Link
              key={`${item.kind}-${item.href}`}
              href={item.href as Route}
              className="group grid min-h-[10rem] content-center gap-2 py-5 lg:min-h-[12rem]"
            >
              <div className="flex items-center justify-between gap-4 text-xs text-[var(--pa-color-ink-muted)]">
                <span>{item.label}</span>
                {item.dateLabel ? <time>{item.dateLabel}</time> : null}
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-[var(--pa-color-ink)]">
                {item.title}
              </h2>
              <p className="line-clamp-3 text-sm leading-6 text-[var(--pa-color-ink-muted)]">
                {item.body}
              </p>
              <ArrowRight className="mt-1 size-4 text-[var(--pa-color-ink-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--pa-color-ink)]" aria-hidden="true" />
            </Link>
          ))}
        </aside>
      </div>
    </section>
  );
}
