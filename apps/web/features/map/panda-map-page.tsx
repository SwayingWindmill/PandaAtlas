/* eslint-disable @next/next/no-img-element -- licensed panda covers are served from the public media origin. */

import type { Route } from "next";
import Link from "next/link";
import { publicShellClassName } from "@/components/patterns/public-shell";
import type { PandaMapItem, PandaMapViewModel } from "@/features/map/panda-map-view-model";
import { PandaWorldMap, type MapCover } from "@/features/map/panda-world-map";
import type { PublicLocale } from "@/foundation/content/locales";

import styles from "./panda-map-page.module.css";

const copy = {
  zh: {
    title: "熊猫在哪里",
    summary: (all: number, overseas: number) => `全世界 ${all} 个地方住着大熊猫，其中 ${overseas} 个在中国以外。`,
    china: "中国",
    overseas: "海外",
    placeCount: (count: number) => `${count} 个地方`,
    pandas: (count: number) => (count ? `${count} 只熊猫` : "现在没有熊猫"),
    empty: "地点资料还在整理中。",
  },
  en: {
    title: "Where pandas live",
    summary: (all: number, overseas: number) =>
      `Giant pandas live in ${all} ${all === 1 ? "place" : "places"} around the world, ${overseas} of them outside China.`,
    china: "China",
    overseas: "Outside China",
    placeCount: (count: number) => `${count} ${count === 1 ? "place" : "places"}`,
    pandas: (count: number) => (count ? `${count} ${count === 1 ? "panda" : "pandas"}` : "No pandas right now"),
    empty: "Places are still being added.",
  },
} as const;

interface PandaMapPageProps {
  locale: PublicLocale;
  view: PandaMapViewModel;
  covers: Record<string, MapCover>;
}

function PlaceRow({ item, cover, locale }: { item: PandaMapItem; cover: MapCover | undefined; locale: PublicLocale }) {
  const t = copy[locale];
  return (
    <li>
      <Link href={item.href as Route} className={styles.row} data-empty={item.residentCount ? "false" : "true"}>
        <span className={styles.thumb}>
          {cover ? (
            <img src={cover.src} alt="" loading="lazy" decoding="async" />
          ) : (
            <span aria-hidden="true">{Array.from(item.name)[0]}</span>
          )}
        </span>
        <span className={styles.rowCopy}>
          <strong>{item.name}</strong>
          <span className={styles.meta}>
            {item.overseas && item.where ? <span>{item.where}</span> : null}
            <span>{t.pandas(item.residentCount)}</span>
          </span>
          {item.residentNames ? <span className={styles.names}>{item.residentNames}</span> : null}
        </span>
      </Link>
    </li>
  );
}

export function PandaMapPage({ locale, view, covers }: PandaMapPageProps) {
  const t = copy[locale];
  const groups = [
    { id: "china", title: t.china, items: view.items.filter((item) => !item.overseas) },
    { id: "overseas", title: t.overseas, items: view.items.filter((item) => item.overseas) },
  ].filter((group) => group.items.length);

  return (
    <main id="main-content" className={styles.page} data-testid="panda-map-page">
      <header className={`${publicShellClassName} ${styles.head}`}>
        <h1>{t.title}</h1>
        {view.livingPlaces ? <p>{t.summary(view.livingPlaces, view.livingPlacesOverseas)}</p> : null}
      </header>

      {view.clusters.length ? (
        <div className={publicShellClassName}>
          <PandaWorldMap locale={locale} clusters={view.clusters} covers={covers} />
        </div>
      ) : null}

      <div id="map-places" className={publicShellClassName}>
        {groups.length ? groups.map((group) => (
          <section key={group.id} className={styles.section} aria-labelledby={`map-group-${group.id}`}>
            <div className={styles.sectionHead}>
              <h2 id={`map-group-${group.id}`}>{group.title}</h2>
              <span className={styles.meta}>{t.placeCount(group.items.length)}</span>
            </div>
            <ul className={styles.rows}>
              {group.items.map((item) => (
                <PlaceRow
                  key={item.id}
                  item={item}
                  cover={item.coverPandaId ? covers[item.coverPandaId] : undefined}
                  locale={locale}
                />
              ))}
            </ul>
          </section>
        )) : <p className={styles.empty}>{t.empty}</p>}
      </div>
    </main>
  );
}
