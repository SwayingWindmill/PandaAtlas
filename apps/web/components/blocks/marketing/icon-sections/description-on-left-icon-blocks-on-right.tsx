/**
 * Registry source: Shadcn UI Blocks / marketing icon sections /
 * description on left, icon blocks on right.
 * Adapted to public PandaAtlas place and residency data.
 */

import { ArrowRight, MapPin } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { HomeV09PlaceSpotlight } from "@/features/home/home-v09-view-model";

export default function PlacesIndex({
  locale,
  places,
}: {
  locale: "zh" | "en";
  places: HomeV09PlaceSpotlight[];
}) {
  if (!places.length) return null;
  const zh = locale === "zh";

  return (
    <section className="mx-auto w-full max-w-[92rem] border-b border-[var(--pa-color-line)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="grid gap-10 md:grid-cols-12 lg:gap-16">
        <div className="md:col-span-5 lg:col-span-4">
          <p className="text-xs font-medium tracking-[0.08em] text-[var(--pa-color-ink-muted)]">
            {zh ? "地点一览" : "PLACES"}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--pa-color-ink)] sm:text-4xl">
            {zh ? "沿公开驻留记录，看见熊猫与地点的连接。" : "Follow pandas through published residency records."}
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--pa-color-ink-muted)] sm:text-base">
            {zh
              ? "这里只展示有公开驻留证据支持的机构与地点，不额外推断更精确的位置。"
              : "Only places supported by published residency evidence are shown, without inferring extra location precision."}
          </p>
          <Link
            href={`/${locale}/map` as Route}
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--pa-color-ink)]"
          >
            {zh ? "打开熊猫地图" : "Open the panda map"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="divide-y divide-[var(--pa-color-line)] border-t border-[var(--pa-color-line)] md:col-span-7 lg:col-span-8">
          {places.slice(0, 5).map((place) => (
            <Link
              key={place.id}
              href={place.href as Route}
              className="group grid min-h-24 grid-cols-[3rem_1fr_auto] items-center gap-4 py-4"
            >
              <span className="grid size-11 place-items-center rounded-full border border-[var(--pa-color-line)] text-[var(--pa-color-ink-muted)]">
                <MapPin className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[var(--pa-color-ink)]">{place.name}</h3>
                <p className="mt-1 text-sm text-[var(--pa-color-ink-muted)]">
                  {zh ? `连接 ${place.pandaCount} 只公开熊猫记录` : `${place.pandaCount} published panda records`}
                </p>
              </div>
              <ArrowRight className="size-4 text-[var(--pa-color-ink-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
