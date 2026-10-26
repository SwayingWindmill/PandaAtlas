/* eslint-disable @next/next/no-img-element -- licensed panda covers are served from the public media origin. */

import type { Route } from "next";
import Link from "next/link";
import { Clock, ExternalLink, Info, MapPin, Route as RouteIcon, Video } from "lucide-react";
import { publicShellClassName } from "@/components/patterns/public-shell";
import { PlaceCheckinControl } from "@/components/places/place-checkin-control";
import {
  listSeparator,
  type InstitutionPageViewModel,
  type InstitutionPandaItem,
  type VisitTipTopic,
} from "@/features/institutions/institution-page-view-model";
import type { PandaCoverMedia } from "@/features/public-content/public-v2";
import type { PublicLocale } from "@/foundation/content/locales";

import styles from "./institution-page.module.css";

const copy = {
  zh: {
    crumbs: "位置",
    map: "地图",
    kinds: { zoo: "动物园", breeding_center: "繁育研究基地", wildlife_park: "野生动物园" },
    liveCam: "看官方直播",
    website: "官方网站",
    residents: "现在住在这里",
    residentCount: (count: number) => `${count} 只`,
    noResidents: "现在没有大熊猫住在这里。",
    visit: "游玩攻略",
    basics: { address: "地址", openingHours: "开放时间", admission: "门票", pandaArea: "熊猫馆" },
    tips: { best_time: "什么时候去", finding_pandas: "熊猫在哪", getting_there: "怎么去", good_to_know: "小贴士" },
    checked: (day: string) => `核对于 ${day}`,
    sources: "来源：",
    noGuide: "这里的参观信息还在整理中，出发前请先看官方网站。",
    history: "曾经住在这里",
    about: (day: string) => `机构资料核对于 ${day}`,
    noPhoto: "还没有照片",
  },
  en: {
    crumbs: "Breadcrumb",
    map: "Map",
    kinds: { zoo: "Zoo", breeding_center: "Breeding and research center", wildlife_park: "Wildlife park" },
    liveCam: "Watch the official live cam",
    website: "Official website",
    residents: "Living here now",
    residentCount: (count: number) => `${count}`,
    noResidents: "No giant pandas live here right now.",
    visit: "Visiting",
    basics: { address: "Address", openingHours: "Opening hours", admission: "Admission", pandaArea: "Panda area" },
    tips: { best_time: "When to go", finding_pandas: "Finding the pandas", getting_there: "Getting there", good_to_know: "Good to know" },
    checked: (day: string) => `Checked ${day}`,
    sources: "Sources: ",
    noGuide: "Visitor details for this place are still being gathered. Check the official website before you go.",
    history: "Lived here before",
    about: (day: string) => `Institution details checked ${day}`,
    noPhoto: "No photo yet",
  },
} as const;

const tipIcons: Record<VisitTipTopic, typeof Clock> = {
  best_time: Clock,
  finding_pandas: MapPin,
  getting_there: RouteIcon,
  good_to_know: Info,
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SourceLinks({ urls, label, locale }: { urls: string[]; label: string; locale: PublicLocale }) {
  if (!urls.length) return null;
  return (
    <span className={styles.sources}>
      {label}
      {urls.map((url, index) => (
        <span key={url}>
          {index ? (locale === "zh" ? "、" : ", ") : null}
          <a href={url} target="_blank" rel="noreferrer">{hostname(url)}</a>
        </span>
      ))}
    </span>
  );
}

/** The day facts were checked and where they come from, set apart by space rather than a separator. */
function Provenance({ checked, urls, label, locale }: { checked: string; urls: string[]; label: string; locale: PublicLocale }) {
  return (
    <p className={`${styles.meta} ${styles.provenance}`}>
      <span>{checked}</span>
      <SourceLinks urls={urls} label={label} locale={locale} />
    </p>
  );
}

function PandaCard({ panda, cover, locale }: { panda: InstitutionPandaItem; cover: PandaCoverMedia | null; locale: PublicLocale }) {
  return (
    <li>
      <Link href={`/${locale}/pandas/${panda.slug}` as Route} className={styles.panda}>
        <span className={styles.pandaPhoto}>
          {cover ? (
            <img src={cover.src} alt={cover.alt} loading="lazy" decoding="async" sizes="(min-width: 900px) 200px, 120px" />
          ) : (
            <span className={styles.noPhoto} aria-hidden="true">{Array.from(panda.name)[0]}</span>
          )}
        </span>
        <span className={styles.pandaCopy}>
          <strong>{panda.name}</strong>
          {panda.alternateName ? <small>{panda.alternateName}</small> : null}
          {panda.detail ? <span>{panda.detail}</span> : null}
          <span>{panda.stay}</span>
        </span>
      </Link>
    </li>
  );
}

interface InstitutionPageProps {
  locale: PublicLocale;
  view: InstitutionPageViewModel;
  covers: Map<string, PandaCoverMedia>;
}

export function InstitutionPage({ locale, view, covers }: InstitutionPageProps) {
  const t = copy[locale];
  const shell = publicShellClassName;
  // Regions are published in English only, so the Chinese page names the country alone.
  const where = locale === "zh" ? view.country : [view.region, view.country].filter(Boolean).join(", ");
  const eyebrow = [view.kind ? t.kinds[view.kind] : null, where]
    .filter(Boolean)
    .join(listSeparator(locale));
  // Only pandas living here now: a former resident's photo would suggest it can still be seen.
  const heroPhotos = view.residents
    .map((panda) => covers.get(panda.id))
    .filter((cover): cover is PandaCoverMedia => Boolean(cover))
    .slice(0, 3);

  return (
    <main id="main-content" className={styles.page} data-testid="institution-page">
      <nav className={`${shell} ${styles.crumbs}`} aria-label={t.crumbs}>
        <Link href={`/${locale}/map` as Route}>{t.map}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{view.name}</span>
      </nav>

      <header className={`${shell} ${styles.hero}`} data-photos={heroPhotos.length ? "true" : "false"}>
        <div className={styles.heroCopy}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1>{view.name}</h1>
          {view.alternateName ? <p className={styles.alt}>{view.alternateName}</p> : null}
          {view.summary ? <p className={styles.lead}>{view.summary}</p> : null}
          {view.liveCamUrl || view.websiteUrl ? (
            <div className={styles.actions}>
              {view.liveCamUrl ? (
                <a className={styles.primary} href={view.liveCamUrl} target="_blank" rel="noreferrer">
                  <Video aria-hidden="true" size={18} />
                  {t.liveCam}
                </a>
              ) : null}
              {view.websiteUrl ? (
                <a className={styles.secondary} href={view.websiteUrl} target="_blank" rel="noreferrer">
                  {t.website}
                  <ExternalLink aria-hidden="true" size={16} />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        {heroPhotos.length ? (
          <div className={styles.photos} data-count={heroPhotos.length}>
            {heroPhotos.map((photo) => (
              <img key={photo.src} src={photo.src} alt={photo.alt} decoding="async" sizes="(min-width: 900px) 40vw, 100vw" />
            ))}
          </div>
        ) : null}
      </header>

      <section className={`${shell} ${styles.section}`} aria-labelledby="institution-residents">
        <div className={styles.sectionHead}>
          <h2 id="institution-residents">{t.residents}</h2>
          {view.residents.length ? <span className={styles.meta}>{t.residentCount(view.residents.length)}</span> : null}
        </div>
        {view.residents.length ? (
          <ul className={styles.pandas}>
            {view.residents.map((panda) => (
              <PandaCard key={panda.id} panda={panda} cover={covers.get(panda.id) ?? null} locale={locale} />
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>{t.noResidents}</p>
        )}
      </section>

      <section className={`${shell} ${styles.section}`} aria-labelledby="institution-visit" data-testid="institution-visit-guide">
        <div className={styles.sectionHead}>
          <h2 id="institution-visit">{t.visit}</h2>
        </div>
        {view.facilities.map((facility) => {
          const hasGuide = facility.basics.length > 0 || facility.tips.length > 0;
          return (
            <article key={facility.placeId} className={styles.facility}>
              {view.facilities.length > 1 ? <h3 className={styles.facilityName}>{facility.name}</h3> : null}
              {hasGuide ? (
                <>
                  {facility.basics.length ? (
                    <dl className={styles.basics}>
                      {facility.basics.map((item) => (
                        <div key={item.key}>
                          <dt>{t.basics[item.key]}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {facility.tips.length ? (
                    <ul className={styles.tips}>
                      {facility.tips.map((tip) => {
                        const Icon = tipIcons[tip.topic];
                        return (
                          <li key={`${tip.topic}:${tip.text}`}>
                            <h4><span aria-hidden="true"><Icon size={16} /></span>{t.tips[tip.topic]}</h4>
                            <p>{tip.text}</p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className={styles.empty}>{t.noGuide}</p>
              )}
              <div className={styles.facilityFoot}>
                <PlaceCheckinControl placeId={facility.placeId} slug={facility.slug} name={facility.name} locale={locale} />
                {facility.verifiedOn ? (
                  <Provenance checked={t.checked(facility.verifiedOn)} urls={facility.sourceUrls} label={t.sources} locale={locale} />
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {view.formerResidents.length ? (
        <section className={`${shell} ${styles.section}`} aria-labelledby="institution-history">
          <div className={styles.sectionHead}>
            <h2 id="institution-history">{t.history}</h2>
          </div>
          <ol className={styles.history}>
            {view.formerResidents.map((panda) => (
              <li key={panda.id}>
                <span className={styles.historyYears}>{panda.stay}</span>
                <Link href={`/${locale}/pandas/${panda.slug}` as Route}>{panda.name}</Link>
                {panda.alternateName ? <small>{panda.alternateName}</small> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {view.profileVerifiedOn ? (
        <footer className={`${shell} ${styles.footnote}`}>
          <Provenance checked={t.about(view.profileVerifiedOn)} urls={view.profileSourceUrls} label={t.sources} locale={locale} />
        </footer>
      ) : null}
    </main>
  );
}
