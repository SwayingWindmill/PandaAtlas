/* eslint-disable @next/next/no-img-element -- review prototype intentionally uses approved remote media. */

import { ArrowRight, ArrowUpRight, Heart, MapPin } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { HomeContentRail } from "@/components/blocks/zhipanda/home-content-rail";
import { HomeReveal } from "@/components/blocks/zhipanda/home-motion";
import { PandaHeroRail, type PandaHeroRailItem } from "@/components/blocks/zhipanda/panda-hero-rail";
import { LicensedHeroVideoSequence } from "@/components/media/licensed-hero-video-sequence";
import type { HomeV09Panda, HomeV09ViewModel } from "@/features/home/home-v09-view-model";
import { ZHIPANDA_HOME_HERO_VIDEOS } from "@/features/home/home-brand-media";

import styles from "./home-community.module.css";

function clean(value: string | null | undefined) {
  return (value ?? "").replaceAll("—", "-");
}

function metaFor(panda: HomeV09Panda, zh: boolean) {
  return [panda.birthYear, panda.placeLabel].filter(Boolean).join(" · ")
    || (zh ? "认识这只熊猫" : "Meet this panda");
}

function friendlyRevision(
  revision: HomeV09ViewModel["revisions"][number],
  zh: boolean,
) {
  if (!zh) return clean(revision.summary);

  switch (revision.panda.slug) {
    case "xiao-qi-ji":
      return "小奇迹的家人、回国经历和现在生活的地方有了更完整的介绍。";
    case "bao-li":
      return "宝力的三代家族关系和现在生活的动物园信息已经补充完整。";
    case "bei-bei":
      return "贝贝的父母、出生信息和现在生活的基地已经补充完整。";
    default:
      return clean(revision.summary)
        .replace("完成", "")
        .replace("的公开整理。", "已经补充到主页。");
  }
}

function PandaImage({
  panda,
  className,
  fallback,
  eager = false,
}: {
  panda: HomeV09Panda;
  className?: string;
  fallback: string;
  eager?: boolean;
}) {
  if (!panda.media) {
    return <div className={styles.noImage}>{fallback}</div>;
  }

  return (
    <img
      src={panda.media.src}
      alt={clean(panda.media.alt)}
      className={className}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
    />
  );
}

export default function HomeCommunity({
  locale,
  model,
  pandaRailItems,
}: {
  locale: "zh" | "en";
  model: HomeV09ViewModel;
  pandaRailItems: PandaHeroRailItem[];
}) {
  const zh = locale === "zh";
  const hero = model.today.lead.panda;
  const discovery = model.explore.pandas
    .filter((panda) => panda.media && panda.id !== hero?.id);
  const heroPandas = hero ? [hero, ...discovery] : discovery;
  const heroVideoPoster = model.explore.pandas.find((panda) => panda.slug === "bao-bao")?.media?.src
    ?? hero?.media?.src
    ?? null;
  const heroRailItems = pandaRailItems.length
    ? pandaRailItems
    : heroPandas
      .filter((panda): panda is HomeV09Panda & { media: NonNullable<HomeV09Panda["media"]> } => Boolean(panda.media))
      .map((panda) => ({
        id: panda.id,
        href: panda.href,
        imageSrc: panda.media.src,
        imageAlt: clean(panda.media.alt),
        name: clean(panda.name),
        meta: clean(metaFor(panda, zh)),
      }));
  const family = model.family;
  const updates = model.revisions.filter((revision) => revision.panda.media).slice(0, 4);
  const leadRevision = model.revisions.find((revision) => revision.panda.id === hero.id) ?? null;
  const leadBody = leadRevision
    ? friendlyRevision(leadRevision, zh)
    : clean(model.today.lead.deck);
  const familyTitle = family?.focus.slug === "mei-xiang"
    ? (zh ? "从美香开始，认识这一家" : "Meet Mei Xiang's family")
    : clean(family?.title);
  const familyBody = family?.focus.slug === "mei-xiang"
    ? (
        zh
          ? "顺着已经确认的亲缘关系，看看美香的孩子和下一代。"
          : "Follow confirmed family links through Mei Xiang's children and the next generation."
      )
    : clean(family?.body);
  const baoLi = model.explore.pandas.find((panda) => panda.slug === "bao-li") ?? null;
  const pandaById = new Map(model.explore.pandas.map((panda) => [panda.id, panda]));
  const placeRows = model.places.slice(0, 3);
  const placeRepresentative = placeRows[0]?.pandaIds
    .map((id) => pandaById.get(id))
    .find((panda) => panda?.media) ?? null;

  if (!hero) return null;

  return (
    <div className={styles.world}>
      <section className={styles.hero}>
        <div className={styles.heroBackdrop}>
          <LicensedHeroVideoSequence
            items={ZHIPANDA_HOME_HERO_VIDEOS}
            poster={heroVideoPoster}
            videoClassName={styles.heroBackdropImage}
            creditClassName={styles.heroVideoCredit}
            showCredit={false}
          />
          <div className={styles.heroWash} aria-hidden="true" />
          <div className={styles.heroFade} aria-hidden="true" />
        </div>

        <div className={styles.heroCenter}>
          <h1>{zh ? "认识每一只熊猫" : "Meet every panda"}</h1>
          <p>
            {zh
              ? "从名字、家人和生活过的地方，走进真实的熊猫世界。"
              : "Enter the real panda world through names, families, and places."}
          </p>
          <div className={styles.heroActions}>
            <Link href={("/" + locale + "/prototype/fan-v08/pandas") as Route} className={styles.heroPrimary}>
              {zh ? "开始认识熊猫" : "Explore pandas"}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link href={("/" + locale + "/my-pandas") as Route} className={styles.heroSecondary}>
              <Heart aria-hidden="true" />
              {zh ? "我的熊猫" : "My Pandas"}
            </Link>
          </div>
        </div>

        <div className={styles.heroRailViewport}>
          <PandaHeroRail
            items={heroRailItems}
            label={zh ? "浏览熊猫" : "Browse pandas"}
            previousLabel={zh ? "向前浏览熊猫" : "Browse previous pandas"}
            nextLabel={zh ? "向后浏览熊猫" : "Browse next pandas"}
          />
        </div>
      </section>

      <section className={styles.discovery} aria-labelledby="discovery-heading">
        <div className={styles.discoveryInner}>
          <div className={styles.discoveryHeading}>
            <h2 id="discovery-heading">{zh ? "继续探索熊猫世界" : "Explore the panda world"}</h2>
            <p>
              {zh
                ? "像逛动物园一样往下走：先认识熊猫，再看看它们的家人和生活过的地方。"
                : "Move through the panda world like a zoo visit: meet pandas, then discover their families and places."}
            </p>
          </div>

          <div className={styles.discoveryGrid}>
            <Link href={("/" + locale + "/prototype/fan-v08/pandas") as Route} className={styles.discoveryPanel}>
              <div className={styles.discoveryMedia}>
                <PandaImage panda={model.today.lead.panda} fallback={zh ? "熊猫" : "Panda"} />
              </div>
              <div className={styles.discoveryCopy}>
                <h3>{zh ? "认识熊猫" : "Meet the pandas"}</h3>
                <p>{leadBody}</p>
                <span>
                  {zh ? "浏览全部熊猫" : "Browse all pandas"}
                  <ArrowRight aria-hidden="true" />
                </span>
              </div>
            </Link>

            {family ? (
              <Link href={family.href as Route} className={styles.discoveryPanel}>
                <div className={styles.discoveryMedia}>
                  <PandaImage panda={family.focus} fallback={family.focus.name} />
                </div>
                <div className={styles.discoveryCopy}>
                  <h3>{zh ? "看看谁和谁是一家" : "Meet a panda family"}</h3>
                  <p>{familyBody}</p>
                  <span>
                    {zh ? "浏览熊猫家族" : "Explore families"}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ) : null}

            <Link href={("/" + locale + "/map") as Route} className={styles.discoveryPanel}>
              <div className={styles.discoveryMedia}>
                {placeRepresentative ? (
                  <PandaImage panda={placeRepresentative} fallback={zh ? "熊猫地点" : "Panda places"} />
                ) : (
                  <div className={styles.noImage}>{zh ? "熊猫地点" : "Panda places"}</div>
                )}
              </div>
              <div className={styles.discoveryCopy}>
                <h3>{zh ? "它们在哪里生活" : "Where pandas live"}</h3>
                <p>
                  {zh
                    ? "从基地和动物园继续认识熊猫，也看看它们曾经生活过的地方。"
                    : "Explore bases, zoos, and the places that connect each panda's story."}
                </p>
                <span>
                  {zh ? "打开熊猫地图" : "Open the panda map"}
                  <ArrowRight aria-hidden="true" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {updates.length ? (
        <section className={styles.activity} aria-labelledby="activity-heading">
          <div className={styles.activityHeading}>
            <div>
              <h2 id="activity-heading">{zh ? "最近有什么新鲜事？" : "What's happening with the pandas?"}</h2>
              <p>
                {zh
                  ? "新的照片、家族变化和生活地点更新，都从这里继续。"
                  : "Recent photos, family changes, and place updates all continue from here."}
              </p>
            </div>
            <Link href={("/" + locale + "/moments") as Route}>
              {zh ? "查看全部动态" : "See all updates"}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>

          <HomeContentRail label={zh ? "最近的熊猫动态" : "Recent panda updates"}>
            {updates.map((revision) => (
              <Link key={revision.id} href={revision.panda.href as Route} className={styles.activityCard}>
                <div className={styles.activityMedia}>
                  <PandaImage panda={revision.panda} fallback={zh ? "暂无照片" : "No photo"} />
                </div>
                <div className={styles.activityCopy}>
                  <div className={styles.activityMeta}>
                    <strong>{clean(revision.panda.name)}</strong>
                    {revision.dateLabel ? <time>{clean(revision.dateLabel)}</time> : null}
                  </div>
                  <h3>{friendlyRevision(revision, zh)}</h3>
                  <span>
                    {zh ? "去看看" : "Take a look"}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </HomeContentRail>
        </section>
      ) : null}

      {family ? (
        <section className={styles.family} aria-labelledby="family-heading">
          <div className={styles.familyInner}>
            <div className={styles.familyPhoto}>
              <PandaImage panda={family.focus} fallback={family.focus.name} />
            </div>

            <div className={styles.familyContent}>
              <div className={styles.familyHeading}>
                <h2 id="family-heading">{familyTitle}</h2>
                <p>{familyBody}</p>
                <Link href={family.href as Route}>
                  {zh ? "查看完整家族" : "Explore the full family"}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>

              <div className={styles.familyList} role="list" aria-label={zh ? "家族成员" : "Family members"}>
                {family.members.slice(0, 4).map((member) => (
                  <Link key={member.id} href={member.href as Route} className={styles.familyRow} role="listitem">
                    <span className={styles.familyRowCopy}>
                      <strong>{clean(member.name)}</strong>
                      <small>
                        {member.relation === "parent"
                          ? (zh ? "上一代" : "Parent")
                          : (zh ? "美香的孩子" : "Child of Mei Xiang")}
                      </small>
                    </span>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                ))}

                {family.focus.slug === "mei-xiang" && baoLi ? (
                  <Link href={baoLi.href as Route} className={styles.familyRow} role="listitem">
                    <span className={styles.familyRowCopy}>
                      <strong>{clean(baoLi.name)}</strong>
                      <small>{zh ? "下一代" : "Next generation"}</small>
                    </span>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.places} aria-labelledby="places-heading">
        <HomeReveal>
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="places-heading">{zh ? "去哪里认识熊猫？" : "Where can you meet pandas?"}</h2>
              <p>{zh ? "基地和动物园，是许多熊猫故事真正发生的地方。" : "Bases and zoos are where many panda stories unfold."}</p>
            </div>
            <Link href={("/" + locale + "/map") as Route}>
              {zh ? "打开地图" : "Open map"}
              <MapPin aria-hidden="true" />
            </Link>
          </div>
        </HomeReveal>

        <HomeContentRail label={zh ? "熊猫地点" : "Panda places"} variant="wide">
          {placeRows.map((place) => {
            const representative = place.pandaIds
              .map((id) => pandaById.get(id))
              .find((panda) => panda?.media);

            return (
              <Link key={place.id} href={place.href as Route} className={styles.placeCard}>
                <div className={styles.placeMedia}>
                  {representative ? (
                    <PandaImage panda={representative} fallback={zh ? "暂无照片" : "No photo"} />
                  ) : (
                    <div className={styles.noImage}>{zh ? "地点故事" : "Place story"}</div>
                  )}
                </div>
                <div className={styles.placeBody}>
                  <strong>{clean(place.name)}</strong>
                  <span>{zh ? String(place.pandaCount) + " 只熊猫与这里有关" : String(place.pandaCount) + " pandas connected here"}</span>
                  <ArrowUpRight aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </HomeContentRail>
      </section>

      <section className={styles.membership} aria-labelledby="membership-heading">
        <div className={styles.membershipCopy}>
          <Heart aria-hidden="true" />
          <div>
            <h2 id="membership-heading">{zh ? "把喜欢的熊猫留在身边" : "Keep your favorite pandas close"}</h2>
            <p>
              {zh
                ? "把你关心的熊猫加入“我的熊猫”，下次回来直接继续。"
                : "Save the pandas you care about and continue from My Pandas next time."}
            </p>
          </div>
        </div>

        <div className={styles.membershipFaces} aria-hidden="true">
          {heroPandas.slice(0, 4).map((panda) => (
            <span key={panda.id}>
              <PandaImage panda={panda} fallback={panda.name} />
            </span>
          ))}
        </div>

        <Link href={("/" + locale + "/my-pandas") as Route} className={styles.membershipAction}>
          {zh ? "打开我的熊猫" : "Open My Pandas"}
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
