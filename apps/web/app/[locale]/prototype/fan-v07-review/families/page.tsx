/* eslint-disable @next/next/no-img-element -- recovered V0.7 review uses explicit historical media fixtures. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, GitFork } from "lucide-react";

import { familyStoryMembers, listFamilyStories, localizedEditorial } from "@/features/public-experiences/data";
import { parsePublicLocale } from "@/foundation/content/locales";

import { withReviewVisuals } from "../review-data";
import { pandaName, pandaPhotoAlt, ReviewShell } from "../review-shell";
import styles from "../review.module.css";

interface Props { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "ZhiPanda family prototype V0.7",
  robots: { index: false, follow: false },
};

export default async function FanV07ReviewFamilies({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const stories = listFamilyStories();
  const featuredStory = stories[0] ?? null;
  const featuredMembers = featuredStory ? withReviewVisuals(familyStoryMembers(featuredStory)) : [];
  const featuredCopy = featuredStory ? localizedEditorial(featuredStory.localized_content, locale) : null;
  const featuredPhoto = featuredMembers.find((member) => member.cover_image_url) ?? null;

  return (
    <ReviewShell locale={locale} active="families">
      <main className={styles.subPage}>
        <div className={styles.subShell}>
          <section className={styles.familyIntro}>
            <p className={styles.sectionLabel}>{zh ? "Panda Families · 熊猫家族" : "Panda Families"}</p>
            <h1>{zh ? "熊猫家族" : "Panda families"}</h1>
            <p>{zh ? "先通过故事认识一个家族，再用谱系图查清父母、孩子、兄弟姐妹和关系证据。家族页负责让关系变得可理解，谱系工具负责让关系可核查。" : "Meet a family through a story first, then use lineage to inspect parents, children, siblings, and evidence. Stories make relationships understandable; lineage makes them verifiable."}</p>
          </section>

          {featuredStory && featuredCopy ? (
            <section className={styles.featureStory}>
              {featuredPhoto?.cover_image_url ? <img src={featuredPhoto.cover_image_url} alt={pandaPhotoAlt(featuredPhoto, locale)} /> : null}
              <span className={styles.featureStoryShade} aria-hidden="true" />
              <div className={styles.featureStoryCopy}>
                <small>Featured family story</small>
                <h2>{featuredCopy.title}</h2>
                <p>{featuredCopy.summary}</p>
                <div className={styles.portraitStack}>
                  {featuredMembers.slice(0, 7).map((member) => (
                    <Link key={member.id} href={`/${locale}/pandas/${member.slug}` as Route} title={pandaName(member, locale)}>
                      {member.cover_image_url ? <img src={member.cover_image_url} alt={pandaName(member, locale)} /> : null}
                    </Link>
                  ))}
                </div>
                <Link className={styles.textAction} href={`/${locale}/families/${featuredStory.slug}` as Route}>{zh ? "阅读完整家族故事" : "Read the full family story"}<ArrowRight aria-hidden="true" /></Link>
              </div>
            </section>
          ) : null}

          <section className={styles.storyDirectory}>
            <div className={styles.storyDirectoryHead}>
              <div><p className={styles.sectionLabel}>{zh ? "Stories · 家族故事" : "Stories"}</p><h2>{zh ? "更多家族" : "More families"}</h2></div>
              <p>{zh ? "每个故事都使用当前已发布的成员和关系范围。" : "Each story follows its currently published member and relationship scope."}</p>
            </div>

            {stories.filter((story) => story.id !== featuredStory?.id).map((story) => {
              const content = localizedEditorial(story.localized_content, locale);
              const members = withReviewVisuals(familyStoryMembers(story));
              const photoMember = members.find((member) => member.cover_image_url) ?? null;
              return (
                <article className={styles.familyStoryCard} key={story.id}>
                  <div className={styles.familyStoryThumb}>{photoMember?.cover_image_url ? <img src={photoMember.cover_image_url} alt={pandaPhotoAlt(photoMember, locale)} loading="lazy" /> : null}</div>
                  <div className={styles.familyStoryText}>
                    <h3>{content.title}</h3>
                    <p>{content.summary}</p>
                    <div className={styles.miniMembers}>
                      {members.slice(0, 7).map((member) => (
                        <Link key={member.id} href={`/${locale}/pandas/${member.slug}` as Route}>
                          {member.cover_image_url ? <img src={member.cover_image_url} alt="" loading="lazy" /> : null}
                          <span>{pandaName(member, locale)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className={styles.familyStoryActions}>
                    <Link href={`/${locale}/families/${story.slug}` as Route}>{zh ? "故事" : "Story"}<ArrowRight aria-hidden="true" /></Link>
                    {members[0] ? <Link href={`/${locale}/families` as Route}><GitFork aria-hidden="true" />{zh ? "谱系" : "Lineage"}</Link> : null}
                  </div>
                </article>
              );
            })}
          </section>
        </div>

        <section className={styles.lineageCallout}>
          <div className={`${styles.subShell} ${styles.lineageCalloutInner}`}>
            <div>
              <h2>{zh ? "需要精确关系时，进入谱系工具。" : "When precision matters, open lineage."}</h2>
              <p>{zh ? "父母关系状态、祖先/后代深度、争议关系、来源和关系路径继续由结构化谱系页面承担。" : "Parentage status, ancestor and descendant depth, disputed relationships, sources, and paths remain in the structured lineage tool."}</p>
            </div>
            <Link className={styles.textAction} href={`/${locale}/families` as Route}>{zh ? "打开家族与谱系" : "Open families + lineage"}<ArrowRight aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
    </ReviewShell>
  );
}
