/* eslint-disable @next/next/no-img-element -- licensed panda covers are served from the public media origin. */

import { ArrowRight, Check, Heart, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type {
  HomeV09Media,
  HomeV09Panda,
  HomeV09Revision,
  HomeV09ViewModel,
} from "@/features/home/home-v09-view-model";
import type { PublicLocale } from "@/foundation/content/locales";

import styles from "./home-page.module.css";

const copy = {
  zh: {
    count: (total: number) => `已收录 ${total} 只熊猫`,
    title: "认识每一只熊猫",
    lede: "每只熊猫的资料、家人和生活过的地方，都写明出处和核实日期。",
    searchLabel: "搜索熊猫",
    searchPlaceholder: "搜索熊猫名字，比如 美香",
    search: "搜索",
    popular: "热门",
    open: "看资料",
    updatesTitle: "最近更新的熊猫",
    updatesBody: "资料有新补充的熊猫排在前面。",
    allPandas: "全部熊猫",
    placesTitle: "按地点找熊猫",
    placesBody: "基地和动物园，是熊猫们生活的地方。",
    map: "打开地图",
    pandaCount: (count: number) => `${count} 只熊猫`,
    trustTitle: "每一条，都有出处",
    trustBody: "我们只整理公开来源里能核实的资料，写明来源和最后核实的日期。",
    trustPoints: ["只用能核实的公开来源", "不编故事，没有就写没有", "每条资料都能查到出处"],
    verified: "最后核实",
    keepTitle: "把喜欢的熊猫留在身边",
    keepBody: "收藏你关心的熊猫，她们的资料有更新时，在「我的熊猫」里一眼看到。",
    keepAction: "打开我的熊猫",
    noPhoto: "暂无授权照片",
  },
  en: {
    count: (total: number) => `${total} pandas in the atlas`,
    title: "Meet every panda",
    lede: "Every panda's profile, family, and places, with sources and verification dates.",
    searchLabel: "Search pandas",
    searchPlaceholder: "Search a panda, e.g. Mei Xiang",
    search: "Search",
    popular: "Popular",
    open: "View profile",
    updatesTitle: "Recently updated pandas",
    updatesBody: "Pandas with new information come first.",
    allPandas: "All pandas",
    placesTitle: "Find pandas by place",
    placesBody: "The bases and zoos where pandas live.",
    map: "Open map",
    pandaCount: (count: number) => `${count} ${count === 1 ? "panda" : "pandas"}`,
    trustTitle: "Every fact has a source",
    trustBody: "We only publish what public sources can verify, with the source and the date it was last checked.",
    trustPoints: ["Only verifiable public sources", "No invented stories; gaps stay visible", "Every fact links to its source"],
    verified: "Last verified",
    keepTitle: "Keep your favorite pandas close",
    keepBody: "Save the pandas you care about and see their updates in My Pandas.",
    keepAction: "Open My Pandas",
    noPhoto: "No licensed photo yet",
  },
} as const;

function Photo({
  media,
  fallback,
  eager = false,
  sizes,
}: {
  media: HomeV09Media | null;
  fallback: string;
  eager?: boolean;
  sizes?: string;
}) {
  if (!media) return <div className={styles.noPhoto}>{fallback}</div>;
  return (
    <img
      src={media.src}
      alt={media.alt}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
    />
  );
}

function meta(panda: HomeV09Panda) {
  return [panda.birthYear, panda.placeLabel].filter(Boolean).join(" · ");
}

export function HomePage({ locale, model }: { locale: PublicLocale; model: HomeV09ViewModel }) {
  const t = copy[locale];
  const lead = model.today.lead;
  const side = model.revisions.find((revision) => revision.panda.id !== lead.panda.id && revision.panda.media) ?? null;

  // Updated pandas lead; the rest of the atlas fills the row when fewer than four were updated.
  const updated: Array<{ panda: HomeV09Panda; revision: HomeV09Revision | null }> = [
    ...model.revisions.map((revision) => ({ panda: revision.panda, revision })),
    ...model.explore.pandas.map((panda) => ({ panda, revision: null })),
  ].filter((item, index, all) => all.findIndex((other) => other.panda.id === item.panda.id) === index).slice(0, 4);

  const popular = model.explore.pandas.slice(0, 5);
  const keepFaces = model.explore.pandas.filter((panda) => panda.media).slice(0, 4);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.chip}>
            <span aria-hidden="true" />
            {t.count(model.explore.totalPublished)}
          </p>
          <h1>{t.title}</h1>
          <p className={styles.lede}>{t.lede}</p>
          <form action={`/${locale}/pandas`} method="get" role="search" className={styles.search}>
            <Search aria-hidden="true" />
            <label htmlFor="home-search" className="sr-only">{t.searchLabel}</label>
            <input id="home-search" name="q" type="search" placeholder={t.searchPlaceholder} autoComplete="off" />
            <button type="submit">{t.search}</button>
          </form>
          {popular.length ? (
            <p className={styles.popular}>
              <span>{t.popular}</span>
              {popular.map((panda) => (
                <Link key={panda.id} href={panda.href as Route}>{panda.name}</Link>
              ))}
            </p>
          ) : null}
        </div>

        <div className={styles.stage}>
          <Link href={lead.href as Route} className={styles.stagePhoto} tabIndex={-1} aria-hidden="true">
            <Photo media={lead.media} fallback={t.noPhoto} eager sizes="(min-width: 1000px) 46vw, 100vw" />
          </Link>
          {lead.panda.placeLabel ? (
            <span className={styles.placeTag}><span aria-hidden="true" />{lead.panda.placeLabel}</span>
          ) : null}
          {side ? (
            <Link href={side.panda.href as Route} className={styles.sideCard}>
              <Photo media={side.panda.media} fallback="" />
              <span>
                <strong>{side.panda.name}</strong>
                <small>{side.dateLabel ?? side.panda.placeLabel}</small>
              </span>
            </Link>
          ) : null}
          <article className={styles.leadCard}>
            <div className={styles.who}>
              <span className={styles.avatar}><Photo media={lead.media} fallback="" /></span>
              <span>
                <strong>{lead.panda.name}</strong>
                <small>{meta(lead.panda)}</small>
              </span>
            </div>
            <span className={styles.status}>{lead.label}</span>
            <p className={styles.quote}>{lead.deck}</p>
            <p className={styles.source}>
              <span>{lead.dateLabel ? `${t.verified} ${lead.dateLabel}` : lead.panda.alternateName}</span>
              <Link href={lead.href as Route}>{t.open}</Link>
            </p>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="home-updates">
        <header className={styles.sectionHead}>
          <div>
            <h2 id="home-updates">{t.updatesTitle}</h2>
            <p>{t.updatesBody}</p>
          </div>
          <Link href={`/${locale}/pandas` as Route} className={styles.more}>
            {t.allPandas}<ArrowRight aria-hidden="true" />
          </Link>
        </header>
        <ul className={styles.cards}>
          {updated.map(({ panda, revision }) => (
            <li key={panda.id}>
              <Link href={panda.href as Route} className={styles.card}>
                <span className={styles.cardPhoto}>
                  <Photo media={panda.media} fallback={t.noPhoto} sizes="(min-width: 1000px) 22vw, 50vw" />
                </span>
                <span className={styles.cardName}>
                  <strong>{panda.name}</strong>
                  {panda.placeLabel ? <small>{panda.placeLabel}</small> : null}
                </span>
                {revision ? <span className={styles.cardQuote}>{revision.summary}</span> : null}
                <span className={styles.cardMeta}>
                  {revision?.dateLabel ? `${t.verified} ${revision.dateLabel}` : meta(panda)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {model.places.length ? (
        <section className={styles.section} aria-labelledby="home-places">
          <header className={styles.sectionHead}>
            <div>
              <h2 id="home-places">{t.placesTitle}</h2>
              <p>{t.placesBody}</p>
            </div>
            <Link href={`/${locale}/map` as Route} className={styles.more}>
              {t.map}<ArrowRight aria-hidden="true" />
            </Link>
          </header>
          <ul className={styles.places} data-count={Math.min(model.places.length, 5)}>
            {model.places.slice(0, 5).map((place) => (
              <li key={place.id}>
                <Link href={place.href as Route} className={styles.place}>
                  <Photo media={place.media} fallback="" sizes="(min-width: 1000px) 30vw, 100vw" />
                  <span>
                    <strong>{place.name}</strong>
                    <small>{t.pandaCount(place.pandaCount)}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`${styles.section} ${styles.trust}`} aria-labelledby="home-trust">
        <div>
          <h2 id="home-trust">{t.trustTitle}</h2>
          <p>{t.trustBody}</p>
          <ul>
            {t.trustPoints.map((point) => (
              <li key={point}><Check aria-hidden="true" />{point}</li>
            ))}
          </ul>
        </div>
        {model.revisions[0] ? (
          <Link href={model.revisions[0].panda.href as Route} className={styles.trustExample}>
            <strong>{model.revisions[0].panda.name}</strong>
            <span className={styles.quote}>{model.revisions[0].summary}</span>
            {model.revisions[0].dateLabel ? (
              <small>{t.verified} {model.revisions[0].dateLabel}</small>
            ) : null}
          </Link>
        ) : null}
      </section>

      <section className={`${styles.section} ${styles.keep}`} aria-labelledby="home-keep">
        <div>
          <h2 id="home-keep">{t.keepTitle}</h2>
          <p>{t.keepBody}</p>
          <Link href={`/${locale}/me` as Route} className={styles.keepAction}>
            <Heart aria-hidden="true" />{t.keepAction}
          </Link>
        </div>
        {keepFaces.length ? (
          <ul className={styles.faces} aria-hidden="true">
            {keepFaces.map((panda) => (
              <li key={panda.id}><Photo media={panda.media} fallback="" /></li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
