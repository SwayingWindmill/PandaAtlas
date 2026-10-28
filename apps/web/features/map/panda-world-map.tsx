"use client";

/* eslint-disable @next/next/no-img-element -- licensed panda covers are served from the public media origin. */

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { PandaMapCluster } from "@/features/map/panda-map-view-model";
import { WORLD_HEIGHT, WORLD_LAND_PATH, WORLD_WIDTH } from "@/features/map/world-land.generated";
import type { PublicLocale } from "@/foundation/content/locales";

import styles from "./panda-map-page.module.css";

export interface MapCover {
  src: string;
  alt: string;
}

interface PandaWorldMapProps {
  locale: PublicLocale;
  clusters: PandaMapCluster[];
  covers: Record<string, MapCover>;
}

const copy = {
  zh: {
    label: "大熊猫所在地世界地图",
    close: "关闭",
    open: "去看看",
    pandas: (count: number) => (count ? `${count} 只熊猫` : "现在没有熊猫"),
    places: (count: number) => `${count} 个地方`,
  },
  en: {
    label: "World map of where giant pandas live",
    close: "Close",
    open: "Take a look",
    pandas: (count: number) => (count ? `${count} ${count === 1 ? "panda" : "pandas"}` : "No pandas right now"),
    places: (count: number) => `${count} places`,
  },
} as const;

/** The smallest tap target, so even an empty place's small dot is easy to hit. */
const MIN_TARGET = 28;

/** Where China sits across the map's width. */
const CHINA_SHARE = 0.76;

function dotSize(count: number): number {
  return count ? Math.min(44, 18 + Math.sqrt(count) * 5) : 12;
}

export function PandaWorldMap({ locale, clusters, covers }: PandaWorldMapProps) {
  const t = copy[locale];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = clusters.find((cluster) => cluster.id === selectedId) ?? null;
  const stageRef = useRef<HTMLDivElement>(null);

  // On a phone the map is wider than the screen and scrolls sideways; start on China, where most pandas live.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || stage.scrollWidth <= stage.clientWidth) return;
    stage.scrollLeft = stage.scrollWidth * CHINA_SHARE - stage.clientWidth / 2;
  }, []);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  return (
    <section className={styles.map} aria-label={t.label} data-testid="panda-world-map">
      <div ref={stageRef} className={styles.stage}>
        <div className={styles.canvas}>
          <svg viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} aria-hidden="true" focusable="false">
            <path className={styles.land} d={WORLD_LAND_PATH} />
          </svg>
          {clusters.map((cluster) => {
            const size = dotSize(cluster.residentCount);
            const single = cluster.items.length === 1 ? cluster.items[0] : null;
            const comma = locale === "zh" ? "，" : ", ";
            const list = locale === "zh" ? "、" : ", ";
            const label = single
              ? `${single.name}${comma}${t.pandas(single.residentCount)}`
              : `${cluster.items.map((item) => item.name).join(list)}${comma}${t.places(cluster.items.length)}`;
            return (
              <a
                key={cluster.id}
                href={single ? single.href : "#map-places"}
                className={styles.dot}
                data-empty={cluster.residentCount ? "false" : "true"}
                data-selected={cluster.id === selectedId ? "true" : "false"}
                style={{ left: `${cluster.left}%`, top: `${cluster.top}%`, width: Math.max(size, MIN_TARGET), height: Math.max(size, MIN_TARGET) }}
                aria-label={label}
                aria-expanded={cluster.id === selectedId}
                onClick={(event) => {
                  event.preventDefault();
                  setSelectedId(cluster.id === selectedId ? null : cluster.id);
                }}
              >
                <span className={styles.dotMark} style={{ width: size, height: size }} aria-hidden="true">
                  {cluster.residentCount > 1 && size >= 24 ? cluster.residentCount : null}
                </span>
              </a>
            );
          })}
        </div>
      </div>
      {selected ? (
        <div
          className={styles.popover}
          data-below={selected.top < 55 ? "true" : "false"}
          style={{
            left: `clamp(0.75rem, calc(${selected.left}% - 9rem), calc(100% - 18.75rem))`,
            top: selected.top < 55 ? `calc(${selected.top}% + 1.75rem)` : undefined,
            bottom: selected.top < 55 ? undefined : `calc(${100 - selected.top}% + 1.75rem)`,
          }}
          role="dialog"
          aria-label={selected.items.map((item) => item.name).join(locale === "zh" ? "、" : ", ")}
        >
          <button type="button" className={styles.close} onClick={() => setSelectedId(null)} aria-label={t.close}>
            <X aria-hidden="true" size={16} />
          </button>
          <ul>
            {selected.items.map((item) => {
              const cover = item.coverPandaId ? covers[item.coverPandaId] : undefined;
              return (
                <li key={item.id}>
                  <Link href={item.href as Route} className={styles.popoverItem}>
                    {cover && selected.items.length === 1 ? <img src={cover.src} alt={cover.alt} decoding="async" /> : null}
                    <span>
                      <strong>{item.name}</strong>
                      <span className={styles.meta}>
                        {item.overseas && item.where ? <span>{item.where}</span> : null}
                        <span>{t.pandas(item.residentCount)}</span>
                      </span>
                      {item.residentNames ? <span className={styles.meta}>{item.residentNames}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
