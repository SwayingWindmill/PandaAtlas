"use client";

/* eslint-disable @next/next/no-img-element -- review media is intentionally rendered directly. */

/**
 * Registry source: Shadcn UI Blocks / marketing gallery / portfolio gallery.
 * The mixed-span gallery and responsive grid are retained; portfolio filters and
 * overlay marketing controls are replaced with PandaAtlas archive records.
 */

import { ArrowRight, ImageOff } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { HomeV09Panda } from "@/features/home/home-v09-view-model";

const spans = [
  "col-span-2 sm:col-span-2 lg:col-span-5 lg:row-span-2",
  "col-span-1 sm:col-span-1 lg:col-span-3",
  "col-span-1 sm:col-span-1 lg:col-span-4",
  "col-span-1 sm:col-span-1 lg:col-span-3",
  "col-span-1 sm:col-span-1 lg:col-span-3",
  "col-span-2 sm:col-span-2 lg:col-span-4",
  "col-span-1 sm:col-span-1 lg:col-span-3",
  "col-span-1 sm:col-span-1 lg:col-span-3",
  "col-span-1 sm:col-span-1 lg:col-span-3",
];

const heights = [
  "min-h-[22rem] sm:min-h-[31rem] lg:min-h-[42rem]",
  "min-h-[12.5rem] sm:min-h-[19rem]",
  "min-h-[12.5rem] sm:min-h-[19rem]",
  "min-h-[12.5rem] sm:min-h-[19rem]",
  "min-h-[12.5rem] sm:min-h-[19rem]",
  "min-h-[16rem] sm:min-h-[19rem]",
  "min-h-[12.5rem] sm:min-h-[19rem]",
  "min-h-[12.5rem] sm:min-h-[19rem]",
  "min-h-[12.5rem] sm:min-h-[19rem]",
];

export default function PandaArchiveGallery({
  locale,
  pandas,
  totalPublished,
}: {
  locale: "zh" | "en";
  pandas: HomeV09Panda[];
  totalPublished: number;
}) {
  const zh = locale === "zh";

  return (
    <section
      className="mx-auto w-full max-w-[92rem] border-b border-[var(--pa-color-line)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
      aria-labelledby="explore-pandas"
    >
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <h2 id="explore-pandas" className="text-3xl font-semibold tracking-[-0.04em] text-[var(--pa-color-ink)] sm:text-4xl">
            {zh ? "探索熊猫" : "Explore pandas"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pa-color-ink-muted)] sm:text-base">
            {zh
              ? `从 ${totalPublished} 只核心公开档案开始，沿年代、地点与家族线索继续认识更多熊猫。`
              : `Start with ${totalPublished} core public records, then keep exploring across eras, places, and family lines.`}
          </p>
        </div>
        <Link
          href={`/${locale}/prototype/fan-v08/pandas` as Route}
          className="hidden min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-[var(--pa-color-ink)] sm:inline-flex"
        >
          {zh ? "浏览全部熊猫" : "Browse all pandas"}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid auto-rows-auto grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-2 sm:gap-y-7 lg:grid-cols-12 lg:gap-x-4 lg:gap-y-8">
        {pandas.slice(0, 9).map((panda, index) => (
          <Link
            key={panda.id}
            href={panda.href as Route}
            className={`group block min-w-0 ${spans[index] ?? "col-span-1 lg:col-span-3"}`}
          >
            <div className={`relative overflow-hidden bg-[var(--pa-color-surface-subtle)] ${heights[index] ?? "min-h-[19rem]"}`}>
              {panda.media ? (
                <img
                  src={panda.media.src}
                  alt={panda.media.alt}
                  loading={index < 3 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.018] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col justify-between border border-[var(--pa-color-line)] p-5">
                  <ImageOff className="size-5 text-[var(--pa-color-ink-muted)]" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium tracking-[0.08em] text-[var(--pa-color-ink-muted)]">
                      {zh ? "公开档案 · 暂无可展示影像" : "PUBLIC RECORD · NO DISPLAY MEDIA"}
                    </p>
                    <p className="mt-2 hidden max-w-[16rem] text-sm leading-6 text-[var(--pa-color-ink-muted)] sm:block">
                      {zh ? "当前公开记录没有可展示影像，我们保留真实的无图状态。" : "The current public record has no display media, so the profile remains honestly image-free."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <h3 className="truncate text-base font-semibold text-[var(--pa-color-ink)]">{panda.name}</h3>
                  {panda.alternateName ? (
                    <span className="truncate text-xs text-[var(--pa-color-ink-muted)]">{panda.alternateName}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--pa-color-ink-muted)]">
                  {[panda.birthYear, panda.placeLabel].filter(Boolean).join(" · ") || (zh ? "公开档案" : "Public record")}
                </p>
              </div>
              <ArrowRight className="mt-1 size-4 shrink-0 text-[var(--pa-color-ink-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>

      <Link
        href={`/${locale}/prototype/fan-v08/pandas` as Route}
        className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--pa-color-ink)] sm:hidden"
      >
        {zh ? "浏览全部熊猫" : "Browse all pandas"}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
