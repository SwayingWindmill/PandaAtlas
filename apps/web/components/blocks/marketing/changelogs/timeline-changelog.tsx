/**
 * Registry source: Shadcn UI Blocks / marketing changelog / timeline changelog.
 * The chronological update model is retained; product-version cards are replaced
 * with a public archive newswire based on PandaAtlas revision summaries.
 */

import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { HomeV09Revision } from "@/features/home/home-v09-view-model";

export default function AtlasRevisionTimeline({
  locale,
  revisions,
}: {
  locale: "zh" | "en";
  revisions: HomeV09Revision[];
}) {
  const zh = locale === "zh";

  if (!revisions.length) return null;

  return (
    <section
      className="mx-auto w-full max-w-[92rem] border-b border-[var(--pa-color-line)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
      aria-labelledby="recently-in-atlas"
    >
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <h2 id="recently-in-atlas" className="text-3xl font-semibold tracking-[-0.04em] text-[var(--pa-color-ink)] sm:text-4xl">
            {zh ? "近期动态" : "Recently in the Atlas"}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--pa-color-ink-muted)]">
            {zh
              ? "这里记录公开档案最近补充了什么，以及这些信息最近一次核实的时间。"
              : "A running view of what changed in public profiles and when those records were last verified."}
          </p>
        </div>

        <div className="border-t border-[var(--pa-color-line)] lg:col-span-9">
          {revisions.slice(0, 6).map((revision) => (
            <Link
              key={revision.id}
              href={revision.panda.href as Route}
              className="group grid gap-2 border-b border-[var(--pa-color-line)] py-5 sm:grid-cols-[8rem_9rem_1fr_auto] sm:items-start sm:gap-4"
            >
              <time className="text-xs tabular-nums text-[var(--pa-color-ink-muted)]">
                {revision.dateLabel ?? (zh ? "核实日期待补" : "Verification date pending")}
              </time>
              <strong className="text-sm font-semibold text-[var(--pa-color-ink)]">
                {revision.panda.name}
              </strong>
              <p className="max-w-3xl text-sm leading-6 text-[var(--pa-color-ink-muted)]">
                {revision.summary}
              </p>
              <ArrowRight className="hidden size-4 text-[var(--pa-color-ink-muted)] transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
