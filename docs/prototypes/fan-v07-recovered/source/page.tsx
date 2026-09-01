/* eslint-disable @next/next/no-img-element -- prototype renders current published external panda media directly. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Dices, Eye, Heart, MapPin, Search, UsersRound } from "lucide-react";

import { AnimatedContent } from "@/components/react-bits/animated-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildEditorialHomeViewModel } from "@/features/home/editorial-home-view-model";
import { loadCachedHabitatMapInput } from "@/features/map/cached-map-data-source";
import { parseStructuredMapQuery } from "@/features/map/map-query";
import { loadPublishedMapDataset } from "@/features/map/map-public-release";
import { buildStructuredMapViewModel } from "@/features/map/map-view-model";
import { buildMapVisualizationModel } from "@/features/map/visualization/map-visual-model";
import { loadPublishedAtlasDataset, loadPublishedPandaProfile } from "@/features/public-content/public-release";
import { buildTrustedProfilePageViewModel } from "@/features/profile/profile-page-view-model";
import { parsePublicLocale } from "@/foundation/content/locales";

import { HomeMap, type HomeMapMarker } from "./home-map";
import { ImmersiveHero, type ImmersiveHeroPanda } from "./immersive-hero";
import { PandaPanorama } from "./panda-panorama";
import { choosePandas, pandaAltName, pandaName, pandaPhotoAlt, PrototypeShell } from "./prototype-kit";
import styles from "./prototype.module.css";

interface Props { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "ZhiPanda immersive homepage prototype",
  robots: { index: false, follow: false },
};

const heroPreferred = ["mei-xiang", "he-hua", "fu-bao", "xiang-xiang", "xiao-qi-ji", "bao-bao", "bei-bei"] as const;
const discoverPreferred = ["meng-lan", "xiao-qi-ji", "xiang-xiang", "fu-bao", "bao-bao", "bei-bei", "ya-lun", "xi-lun", "shin-shin", "ri-ri"] as const;

function eventLabel(kind: string, zh: boolean): string {
  if (!zh) return kind.replaceAll("_", " ");
  const labels: Record<string, string> = {
    residency: "生活地点",
    birth: "出生",
    arrival: "抵达",
    transfer: "迁居",
    return: "返回",
    naming: "命名",
    public_debut: "公开亮相",
    announcement: "公开消息",
    observation: "记录",
    death: "去世",
  };
  return labels[kind] ?? kind;
}

function yearLabel(date: string): string {
  return date.slice(0, 4);
}

export default async function FanV07Home({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";

  const atlas = loadPublishedAtlasDataset(locale);
  const home = buildEditorialHomeViewModel(atlas, locale);
  const withPhoto = atlas.data.pandas.filter((panda) => Boolean(panda.cover_image_url));
  const heroPandas = choosePandas(withPhoto, heroPreferred, 6);
  const discoverPandas = choosePandas(withPhoto, discoverPreferred, 10);
  const pandaById = new Map(atlas.data.pandas.map((panda) => [panda.id, panda]));

  const familyEnvelope = loadPublishedPandaProfile("mei-xiang", locale);
  const familyProfile = familyEnvelope ? buildTrustedProfilePageViewModel(familyEnvelope.data, locale) : null;
  const familyPanda = familyEnvelope?.data.panda ?? heroPandas[0] ?? null;
  const featuredPanda = familyPanda ?? heroPandas[0] ?? null;
  const familyChildren = familyProfile?.family.children.flatMap((relation) => {
    const panda = pandaById.get(relation.id);
    return panda ? [panda] : [];
  }).slice(0, 5) ?? [];
  const familyTimeline = familyProfile?.timeline.items
    .filter((item) => item.kind !== "residency")
    .slice(0, 4) ?? [];
  const familyFootprint = familyProfile?.footprint.stops.slice(0, 4) ?? [];

  const immersiveHeroPandas: ImmersiveHeroPanda[] = featuredPanda ? [{
    id: featuredPanda.id,
    slug: featuredPanda.slug,
    name: pandaName(featuredPanda, locale),
    meta: [featuredPanda.birth_date?.slice(0, 4), featuredPanda.current_location].filter(Boolean).join(" · "),
    imageUrl: featuredPanda.cover_image_url ?? "",
    imageAlt: pandaPhotoAlt(featuredPanda, locale),
  }] : [];

  const birthdays = home.returnVisit.birthdays.flatMap((birthday) => {
    const panda = pandaById.get(birthday.id);
    return panda ? [{ ...birthday, panda }] : [];
  }).slice(0, 4);

  const mapEnvelope = loadPublishedMapDataset(locale);
  const habitatInput = loadCachedHabitatMapInput({ bbox: "73,18,136,54" });
  const mapState = parseStructuredMapQuery({}, mapEnvelope.release.id).state;
  const mapView = buildStructuredMapViewModel(mapEnvelope.data, mapEnvelope.sources, habitatInput, mapState, locale);
  const mapVisual = buildMapVisualizationModel(mapView, habitatInput, locale, mapState);
  const markerGroups = new Map<string, HomeMapMarker & { count: number }>();
  for (const feature of mapVisual.collection.features) {
    if (feature.geometry.type !== "Point") continue;
    const coordinates = feature.geometry.coordinates as [number, number];
    const key = `${coordinates[0]},${coordinates[1]}`;
    const existing = markerGroups.get(key);
    if (existing) {
      existing.count += 1;
      existing.subtitle = zh ? `${existing.count} 条公开地图记录` : `${existing.count} published map records`;
      continue;
    }
    markerGroups.set(key, {
      id: feature.properties.id,
      title: feature.properties.subtitle || feature.properties.title,
      subtitle: zh ? "1 条公开地图记录" : "1 published map record",
      href: `/${locale}/prototype/fan-v07/map`,
      coordinates,
      count: 1,
    });
  }
  const homeMapMarkers: HomeMapMarker[] = [...markerGroups.values()].map(({ count: _count, ...marker }) => marker);

  const browseLinks = [
    { label: zh ? "全部熊猫" : "Pandas", href: `/${locale}/prototype/fan-v07/pandas`, icon: null },
    { label: zh ? "家族" : "Families", href: `/${locale}/prototype/fan-v07/families`, icon: UsersRound },
    { label: zh ? "地点" : "Places", href: `/${locale}/prototype/fan-v07/map`, icon: MapPin },
    { label: zh ? "时间" : "Moments", href: `/${locale}/prototype/fan-v07/moments`, icon: CalendarDays },
  ] as const;

  return (
    <PrototypeShell locale={locale}>
      <main className={styles.immersiveMain}>
        <ImmersiveHero locale={locale} pandas={immersiveHeroPandas} total={atlas.data.pandas.length} />

        <section className={styles.threadScene}>
          <div className={styles.sceneShell}>
            <div className={styles.threadIntro}>
              <p>{zh ? "从一只熊猫开始" : "Start with one panda"}</p>
              <h2>{featuredPanda ? (zh
                ? `从${pandaName(featuredPanda, locale)}开始，看见一只熊猫如何连接到家族、地点与时间。`
                : `Start with ${pandaName(featuredPanda, locale)} and see how one panda connects family, place, and time.`) : (zh ? "从一只熊猫开始。" : "Start with one panda.")}</h2>
            </div>

            <div className={styles.threadBody}>
              <div className={styles.threadIdentity}>
                {featuredPanda ? (
                  <>
                    <strong>{pandaName(featuredPanda, locale)}</strong>
                    <span>{[pandaAltName(featuredPanda, locale), featuredPanda.birth_date?.slice(0, 4), featuredPanda.current_location].filter(Boolean).join(" · ")}</span>
                    <Link href={`/${locale}/prototype/fan-v07/panda/${featuredPanda.slug}` as Route}>{zh ? "打开完整档案" : "Open full profile"}<ArrowRight aria-hidden="true" /></Link>
                  </>
                ) : null}
                <div className={styles.birthdayStrip}>
                  <span>{zh ? "最近生日" : "Upcoming birthdays"}</span>
                  <div>
                    {birthdays.map(({ panda }) => (
                      <Link key={panda.id} href={`/${locale}/prototype/fan-v07/panda/${panda.slug}` as Route} title={pandaName(panda, locale)}>
                        {panda.cover_image_url ? <img src={panda.cover_image_url} alt={pandaName(panda, locale)} /> : null}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <ol className={styles.threadTimeline}>
                {familyTimeline.map((item) => (
                  <li key={item.id}>
                    <span>{yearLabel(item.date)}</span>
                    <strong>{eventLabel(item.kind, zh)}</strong>
                    <p>{item.fromLabel ? `${item.fromLabel} → ${item.toLabel}` : item.toLabel}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {familyPanda ? (
          <section className={styles.familyScene}>
            <img className={styles.familySceneBackground} src={familyPanda.cover_image_url ?? ""} alt="" />
            <div className={styles.familySceneShade} />
            <AnimatedContent className={styles.familySceneContent} direction="horizontal" reverse distance={90} duration={1.1}>
              <h2>{zh ? `${pandaName(familyPanda, locale)}不是一个孤立的名字。` : `${pandaName(familyPanda, locale)} is not an isolated name.`}</h2>
              <p>{zh ? "沿着父母、孩子与兄弟姐妹，熊猫档案会长成一个真正的家族故事。" : "Follow parents, children, and siblings and a panda profile becomes a family story."}</p>
              <Button asChild className={styles.familyCta}><Link href={`/${locale}/prototype/fan-v07/families` as Route}>{zh ? "进入这个家族" : "Enter this family"}<ArrowRight aria-hidden="true" /></Link></Button>
              {familyChildren.length ? (
                <div className={styles.familyJourney}>
                  <div className={styles.familyJourneyRoot}><span>{familyPanda.cover_image_url ? <img src={familyPanda.cover_image_url} alt="" /> : null}</span><strong>{pandaName(familyPanda, locale)}</strong></div>
                  <span className={styles.familyJourneyLine} aria-hidden="true" />
                  {familyChildren.map((panda) => <Link key={panda.id} href={`/${locale}/prototype/fan-v07/panda/${panda.slug}` as Route}><span>{panda.cover_image_url ? <img src={panda.cover_image_url} alt="" loading="lazy" /> : null}</span><strong>{pandaName(panda, locale)}</strong></Link>)}
                </div>
              ) : null}
            </AnimatedContent>
          </section>
        ) : null}

        <section className={styles.journeyScene}>
          <div className={styles.sceneShell}>
            <div className={styles.journeyGrid}>
              <div className={styles.journeyCopy}>
                <h2>{zh ? `从${familyPanda ? pandaName(familyPanda, locale) : "一只熊猫"}的生活足迹，再打开世界地图。` : "From one panda's life footprint, open the wider panda map."}</h2>
                <p>{zh ? "地点不是一枚孤立的图钉。先看它在哪里生活过，再去认识同一地点里的其他熊猫。" : "A place is more than a pin. Start with where this panda lived, then meet the others connected to the same places."}</p>
                <div className={styles.footprintList}>
                  {familyFootprint.map((stop) => (
                    <div key={stop.id}>
                      <span>{yearLabel(stop.startDate)}</span>
                      <strong>{stop.label}</strong>
                      {stop.current ? <em>{zh ? "现在" : "Now"}</em> : null}
                    </div>
                  ))}
                </div>
                <Link className={styles.textLink} href={`/${locale}/prototype/fan-v07/map` as Route}>{zh ? "打开完整熊猫地图" : "Open the full panda map"}<ArrowRight aria-hidden="true" /></Link>
              </div>
              <HomeMap locale={locale} markers={homeMapMarkers} />
            </div>
          </div>
        </section>

        <section className={styles.worldScene}>
          <div className={styles.sceneShell}>
            <div className={styles.worldHeading}>
              <h2>{zh ? `然后，世界打开：${atlas.data.pandas.length} 只熊猫。` : `Then the world opens: ${atlas.data.pandas.length} pandas.`}</h2>
              <Link href={`/${locale}/prototype/fan-v07/pandas` as Route}>{zh ? "浏览全部熊猫" : "Browse all pandas"}<ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
          <PandaPanorama
            locale={locale}
            pandas={discoverPandas.slice(0, 6).map((panda) => ({
              id: panda.id,
              slug: panda.slug,
              name: pandaName(panda, locale),
              meta: panda.current_location ?? panda.birth_date?.slice(0, 4) ?? "",
              imageUrl: panda.cover_image_url ?? "",
              imageAlt: pandaPhotoAlt(panda, locale),
            }))}
          />

          <div className={styles.sceneShell}>
            <div className={styles.discoveryRail}>
              <form className={styles.discoverySearch} action={`/${locale}/prototype/fan-v07/search`} method="get" role="search">
                <Search aria-hidden="true" />
                <Input name="q" type="search" aria-label={zh ? "搜索熊猫" : "Search pandas"} placeholder={zh ? "搜名字：美香、和花、福宝……" : "Search Mei Xiang, He Hua, Fu Bao…"} />
                <Button type="submit">{zh ? "搜索" : "Search"}</Button>
              </form>
              <nav className={styles.browseLinks} aria-label={zh ? "更多探索方式" : "More ways to explore"}>
                {browseLinks.map(({ label, href, icon: Icon }) => (
                  <Link key={href} href={href as Route}>{Icon ? <Icon aria-hidden="true" /> : null}{label}<ArrowRight aria-hidden="true" /></Link>
                ))}
              </nav>
              <div className={styles.playLinks}>
                <Link href={`/${locale}/games/random` as Route}><Dices aria-hidden="true" />{zh ? "随机遇见一只" : "Meet one at random"}</Link>
                <Link href={`/${locale}/games/guess` as Route}>{zh ? "猜猜是哪只熊猫" : "Guess the panda"}<ArrowRight aria-hidden="true" /></Link>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.returnScene}>
          <div className={styles.sceneShell}>
            <div className={styles.returnGrid}>
              <div className={styles.returnUpdates}>
                <h2>{zh ? "今天有新的，明天也值得回来。" : "There is something new today, and a reason to return tomorrow."}</h2>
                <div className={styles.updateList}>
                  {home.revisions.items.slice(0, 3).map((item) => (
                    <Link key={item.id} href={item.href as Route} className={styles.updateItem}>
                      <span><strong>{item.pandaName}</strong>{item.alternateName ? <em>{item.alternateName}</em> : null}</span>
                      <p>{item.summary}</p>
                      <small>{item.verifiedLabel}</small>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>

              <div className={styles.returnMemory}>
                {discoverPandas[7]?.cover_image_url ? <img src={discoverPandas[7].cover_image_url ?? ""} alt={pandaPhotoAlt(discoverPandas[7], locale)} /> : null}
                <div className={styles.returnMemoryCopy}>
                  <h3>{zh ? "把喜欢过、见过、去过的熊猫留下来。" : "Keep the pandas you loved, saw, and visited."}</h3>
                  <div><span><Heart aria-hidden="true" />{zh ? "喜欢" : "Favorite"}</span><span><Eye aria-hidden="true" />{zh ? "见过" : "Seen"}</span><span><MapPin aria-hidden="true" />{zh ? "去过" : "Visited"}</span></div>
                  <Button asChild><Link href={`/${locale}/prototype/fan-v07/me` as Route}>{zh ? "打开我的熊猫" : "Open My Pandas"}<ArrowRight aria-hidden="true" /></Link></Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PrototypeShell>
  );
}
