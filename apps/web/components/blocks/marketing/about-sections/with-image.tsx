/* eslint-disable @next/next/no-img-element -- review media is intentionally rendered directly. */

/**
 * Registry source: Shadcn UI Blocks / marketing about sections / with image.
 * Adapted for a published PandaAtlas family spotlight.
 */

import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { HomeV09FamilySpotlight } from "@/features/home/home-v09-view-model";

export default function FamilyStoryWithImage({
  locale,
  family,
}: {
  locale: "zh" | "en";
  family: HomeV09FamilySpotlight | null;
}) {
  if (!family) return null;
  const zh = locale === "zh";

  return (
    <section className="mx-auto w-full max-w-[92rem] border-b border-[var(--pa-color-line)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <p className="text-xs font-medium tracking-[0.08em] text-[var(--pa-color-ink-muted)]">
            {zh ? "家族故事" : "FAMILY STORY"}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-[var(--pa-color-ink)] sm:text-4xl">
            {family.title}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--pa-color-ink-muted)]">
            {family.body}
          </p>

          <div className="mt-7 border-t border-[var(--pa-color-line)]">
            <div className="grid min-h-14 grid-cols-[1fr_auto] items-center border-b border-[var(--pa-color-line)] py-2">
              <div>
                <strong className="text-sm text-[var(--pa-color-ink)]">{family.focus.name}</strong>
                <span className="ml-2 text-xs text-[var(--pa-color-ink-muted)]">
                  {zh ? "焦点个体" : "Focus"}
                </span>
              </div>
            </div>
            {family.members.slice(0, 5).map((member) => (
              <Link
                key={member.id}
                href={member.href as Route}
                className="grid min-h-14 grid-cols-[1fr_auto] items-center border-b border-[var(--pa-color-line)] py-2"
              >
                <div>
                  <strong className="text-sm text-[var(--pa-color-ink)]">{member.name}</strong>
                  {member.alternateName ? (
                    <span className="ml-2 text-xs text-[var(--pa-color-ink-muted)]">{member.alternateName}</span>
                  ) : null}
                </div>
                <span className="text-xs text-[var(--pa-color-ink-muted)]">
                  {member.relation === "parent"
                    ? (zh ? "亲本" : "Parent")
                    : (zh ? "子代" : "Child")}
                </span>
              </Link>
            ))}
          </div>

          <Link
            href={family.href as Route}
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--pa-color-ink)]"
          >
            {zh ? "进入完整家族" : "Explore the full family"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="lg:col-span-7">
          {family.focus.media ? (
            <img
              src={family.focus.media.src}
              alt={family.focus.media.alt}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="grid aspect-[4/3] place-items-center border border-[var(--pa-color-line)] bg-[var(--pa-color-surface-subtle)]">
              <span className="text-sm text-[var(--pa-color-ink-muted)]">
                {zh ? "当前公开档案暂无可展示影像" : "No display media in the current public record"}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
