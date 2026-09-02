/* eslint-disable @next/next/no-img-element -- recovered visual review uses explicitly isolated historical photo fixtures. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, GitFork } from "lucide-react";

import { familyStoryMembers, listFamilyStories, localizedEditorial } from "@/features/public-experiences/data";
import { parsePublicLocale } from "@/foundation/content/locales";

import { reviewImage, reviewImageAlt, reviewName } from "../review-data";
import { ReviewShell } from "../review-shell";
import styles from "../review.module.css";

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "ZhiPanda V0.7 families review",
  robots: { index: false, follow: false },
};

export default async function FanV07ReviewFamilies({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const stories = listFamilyStories();
  const featuredStory = stories[0] ?? null;
  const featuredMembers = featuredStory ? familyStoryMembers(featuredStory) : [];
  const featuredCopy = featuredStory ? localizedEditorial(featuredStory.localized_content, locale) : null;
  const featuredPhoto = featuredMembers.find((member) => reviewImage(member)) ?? null;

  return (
    <ReviewShell locale={locale} active="families">
      <main className={styles.main}>
        <div className={styles.shell}>
          <section className={styles.familyHero}>
            <span className={styles.sectionMeta}>PANDA FAMILIES</span>
            <h1 className={styles.display}>{zh ? "熊猫家族" : "Panda families"}</h1>
            <p>{zh ? "V0.7 的家族页不是先丢给普通爱好者一张复杂关系图，而是先通过故事和照片认识一个家族；只有当用户需要精确关系时，再进入谱系工具。" : "V0.7 did not begin with a dense relationship graph. It introduced a family through story and photography first, leaving precise verification to the lineage tool."}</p>
          </section>

          {featuredStory && featuredCopy ? (
            <section className={styles.featureStory}>
              {featuredPhoto && reviewImage(featuredPhoto) ? <img src={reviewImage(featuredPhoto) ?? ""} alt={reviewImageAlt(featuredPhoto, locale)} /> : null}
              <div className={styles.featureCopy}>
                <small>FEATURED FAMILY STORY</small>
                <h2>{featuredCopy.title}</h2>
                <p>{featuredCopy.summary}</p>
                <div className={styles.familyStrip}>
                  {featuredMembers.slice(0, 7).map((member) => (
                    <Link className={styles.familyMember} key={member.id} href={`/${locale}/pandas/${member.slug}` as Route} title={reviewName(member, locale)}>
                      <span>{reviewImage(member) ? <img src={reviewImage(member) ?? ""} alt={reviewImageAlt(member, locale)} /> : null}</span>
                      <small>{reviewName(member, locale)}</small>
                    </Link>
                  ))}
                </div>
                <Link className={styles.textLink} href={`/${locale}/families/${featuredStory.slug}` as Route}>{zh ? "阅读完整家族故事" : "Read the full family story"}<ArrowRight aria-hidden="true" /></Link>
              </div>
            </section>
          ) : null}

          <section className={styles.familyStories}>
            <div className={styles.directoryHeader}>
              <div><span className={styles.sectionMeta}>STORIES</span><h2>{zh ? "更多家族" : "More families"}</h2></div>
              <p>{zh ? "这里恢复的是 V0.7 的“故事入口 + 谱系核查”双层结构。家族故事负责理解，谱系负责精确。" : "This restores the V0.7 two-layer model: family stories for understanding, lineage for precision."}</p>
            </div>

            {stories.filter((story) => story.id !== featuredStory?.id).map((story) => {
              const content = localizedEditorial(story.localized_content, locale);
              const members = familyStoryMembers(story);
              const photoMember = members.find((member) => reviewImage(member)) ?? null;
              return (
                <article className={styles.familyStoryRow} key={story.id}>
                  <div className={styles.familyThumb}>{photoMember && reviewImage(photoMember) ? <img src={reviewImage(photoMember) ?? ""} alt={reviewImageAlt(photoMember, locale)} loading="lazy" /> : null}</div>
                  <div className={styles.familyStoryText}>
                    <h3>{content.title}</h3>
                    <p>{content.summary}</p>
                    <div className={styles.familyNames}>{members.map((member) => reviewName(member, locale)).join(" · ")}</div>
                  </div>
                  <Link className={styles.rowAction} href={`/${locale}/families/${story.slug}` as Route}>{zh ? "故事" : "Story"}<ArrowRight aria-hidden="true" /></Link>
                </article>
              );
            })}

            <div className={styles.directoryHeader} style={{ marginTop: "5rem" }}>
              <div><span className={styles.sectionMeta}>LINEAGE</span><h2>{zh ? "需要精确关系时，进入谱系。" : "When precision matters, open lineage."}</h2></div>
              <Link className={styles.rowAction} href={`/${locale}/families` as Route}><GitFork aria-hidden="true" />{zh ? "打开正式家族与谱系" : "Open production families + lineage"}</Link>
            </div>
          </section>
        </div>
      </main>
    </ReviewShell>
  );
}
