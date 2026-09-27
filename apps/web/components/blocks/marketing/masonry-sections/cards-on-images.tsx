/* eslint-disable @next/next/no-img-element -- review media is intentionally rendered directly. */

/**
 * Registry source: Shadcn UI Blocks / marketing masonry / cards on images.
 * The staggered masonry rhythm is retained and driven by PandaAtlas curated sets.
 */

import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { HomeV09Collection, HomeV09Panda } from "@/features/home/home-v09-view-model";

const spans = [
  "sm:col-span-7 md:col-span-8 lg:col-span-5 lg:col-start-2",
  "sm:col-span-5 md:col-span-4 lg:col-span-4",
  "md:col-span-4 lg:col-span-4",
  "sm:col-span-6 md:col-span-4 lg:col-span-3",
];

export default function AtlasCollections({
  locale,
  collections,
  pandas,
}: {
  locale: "zh" | "en";
  collections: HomeV09Collection[];
  pandas: HomeV09Panda[];
}) {
  if (!collections.length) return null;
  const zh = locale === "zh";
  const pandaById = new Map(pandas.map((panda) => [panda.id, panda]));

  return (
    <section className="mx-auto w-full max-w-[92rem] border-b border-[var(--pa-color-line)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="mb-8">
        <p className="text-xs font-medium tracking-[0.08em] text-[var(--pa-color-ink-muted)]">
          {zh ? "精选专题" : "CURATED COLLECTIONS"}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--pa-color-ink)] sm:text-4xl">
          {zh ? "换一种方式进入档案。" : "Enter the archive from another angle."}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-12">
        {collections.slice(0, 4).map((collection, index) => {
          const representative = collection.pandaIds
            .map((id) => pandaById.get(id))
            .find((panda): panda is HomeV09Panda => Boolean(panda?.media));

          return (
            <Link
              key={collection.id}
              href={collection.href as Route}
              className={`group relative block min-h-[19rem] overflow-hidden bg-[var(--pa-color-surface-subtle)] ${spans[index] ?? "sm:col-span-6"}`}
            >
              {representative?.media ? (
                <img
                  src={representative.media.src}
                  alt={representative.media.alt}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015] motion-reduce:transition-none"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/15 to-transparent" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                <p className="text-xs text-white/70">
                  {zh ? `${collection.pandaIds.length} 个公开档案` : `${collection.pandaIds.length} public records`}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">
                  {collection.title}
                </h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-white/78">
                  {collection.description}
                </p>
                <span className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium">
                  {zh ? "打开专题" : "Open collection"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
