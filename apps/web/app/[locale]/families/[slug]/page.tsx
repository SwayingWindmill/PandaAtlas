import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalNavigation } from "@/components/patterns/global-navigation";
import {
  familyStoryAssertions,
  familyStoryEvents,
  familyStoryMembers,
  familyStorySources,
  getFamilyStory,
  listFamilyStories,
  localizedEditorial,
  publicExperienceRelease,
} from "@/features/public-experiences/data";
import styles from "@/features/public-experiences/public-experiences.module.css";
import { parsePublicLocale, PUBLIC_LOCALES } from "@/foundation/content/locales";
import type { PandaDetail, PublicFamilyStoryRecord } from "@/lib/types";

interface FamilyStoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const copy = {
  zh: {
    eyebrow: "Family Fieldbook · 熊猫家族志",
    release: "公开版本",
    members: "故事成员",
    chapters: "家族篇章",
    evidence: "关系证据与来源",
    scope: "声明范围",
    confirmed: "已确认",
    tentative: "暂定",
    excluded: "范围外关系",
    source: "主要来源",
    relationship: "亲本断言",
    events: "引用事件",
    profile: "打开档案",
    lineage: "在家族谱系中查看",
    moments: "在熊猫时光中查看",
    otherStories: "其他家族故事",
    partial: "当前故事为明确声明的部分范围，不代表完整生物学家族。",
    complete: "当前故事对其声明范围完整；未声明成员仍不被解释为不存在。",
    footer: "章节只引用已发布成员、事件、关系和来源；编辑分组不构成新的亲缘证据。",
  },
  en: {
    eyebrow: "Family Fieldbook · reviewed family narratives",
    release: "public release",
    members: "Story members",
    chapters: "Family chapters",
    evidence: "Relationship evidence and sources",
    scope: "Declared scope",
    confirmed: "Confirmed",
    tentative: "Tentative",
    excluded: "Out-of-scope relationships",
    source: "Primary source",
    relationship: "Parentage assertion",
    events: "Referenced events",
    profile: "Open profile",
    lineage: "View family lineage",
    moments: "View in Panda Moments",
    otherStories: "Other family stories",
    partial: "This story has an explicitly partial scope and does not represent a complete biological family.",
    complete: "This story is complete for its declared scope; undeclared members are not treated as absent.",
    footer: "Chapters only reference published members, events, relationships, and sources. Editorial grouping creates no new kinship evidence.",
  },
} as const;

function displayName(locale: "zh" | "en", panda: PandaDetail): string {
  return locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
}

function relationshipLabel(
  locale: "zh" | "en",
  story: PublicFamilyStoryRecord,
  assertionId: string,
  members: PandaDetail[],
): string {
  const assertion = familyStoryAssertions(story).find((item) => item.id === assertionId);
  if (!assertion) return assertionId;
  const child = members.find((item) => item.id === assertion.child_id);
  const parent = members.find((item) => item.id === assertion.parent_id);
  const role = locale === "zh"
    ? assertion.role === "mother" ? "母亲" : "父亲"
    : assertion.role === "mother" ? "mother" : "father";
  return `${parent ? displayName(locale, parent) : assertion.parent_id} → ${child ? displayName(locale, child) : assertion.child_id} · ${role}`;
}

export function generateStaticParams() {
  return PUBLIC_LOCALES.flatMap((locale) =>
    listFamilyStories().map((story) => ({ locale, slug: story.slug })),
  );
}

export async function generateMetadata({ params }: FamilyStoryPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const story = getFamilyStory(slug);
  if (!locale || !story) return {};
  const content = localizedEditorial(story.localized_content, locale);
  return { title: content.title, description: content.summary };
}

export default async function FamilyStoryPage({ params }: FamilyStoryPageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const story = getFamilyStory(slug);
  if (!locale || !story) notFound();
  const content = localizedEditorial(story.localized_content, locale);
  const members = familyStoryMembers(story);
  const assertions = familyStoryAssertions(story);
  const events = familyStoryEvents(story);
  const sources = familyStorySources(story);
  const t = copy[locale];
  const alternateLocale = locale === "zh" ? "en" : "zh";
  const confirmedCount = assertions.filter((item) => item.status === "confirmed").length;
  const tentativeCount = assertions.filter((item) => item.status === "tentative").length;
  const scopeCopy = story.scope.coverage_state === "partial" ? t.partial : t.complete;
  const relatedStories = listFamilyStories().filter((item) => item.id !== story.id);

  return (
    <div className={styles.page}>
      <GlobalNavigation
        locale={locale}
        active="families"
        alternatePath={`/${alternateLocale}/families/${story.slug}`}
      />
      <main id="main-content">
        <div className={styles.shell}>
          <p className={styles.releaseNote}>
            {t.release}: {publicExperienceRelease.dataset_release_version} · Schema {publicExperienceRelease.public_schema_version}
          </p>
          <section className={styles.hero} aria-labelledby="family-title">
            <div className={styles.storyHero}>
              <div>
                <p className={styles.eyebrow}>{t.eyebrow}</p>
                <h1 className={styles.title} id="family-title">{content.title}</h1>
                <p className={styles.dek}>{content.summary}</p>
              </div>
              <aside className={styles.scope} aria-label={t.scope}>
                <strong>{t.scope}</strong>
                {scopeCopy}
              </aside>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.stat}><strong>{members.length}</strong><span>{t.members}</span></div>
              <div className={styles.stat}><strong>{confirmedCount}</strong><span>{t.confirmed}</span></div>
              <div className={styles.stat}><strong>{tentativeCount}</strong><span>{t.tentative}</span></div>
              <div className={styles.stat}><strong>{events.length}</strong><span>{t.events}</span></div>
            </div>
            <nav className={styles.directory} aria-label={locale === "zh" ? "页面目录" : "Page directory"}>
              <a href="#members">{t.members}</a>
              <a href="#chapters">{t.chapters}</a>
              <a href="#evidence">{t.evidence}</a>
            </nav>
          </section>

          <section className={styles.section} id="members" aria-labelledby="members-title">
            <div className={styles.sectionHeader}>
              <div><p className={styles.eyebrow}>01 · Member constellation</p><h2 id="members-title">{t.members}</h2></div>
              <p>{locale === "zh" ? "成员资格是编辑范围，不是亲缘证明。每条连接仍由独立亲本断言支持。" : "Membership is editorial scope, not proof of kinship. Every connection remains backed by an independent parentage assertion."}</p>
            </div>
            <div className={styles.members}>
              {members.map((member) => (
                <article className={styles.member} key={member.id}>
                  <Link href={`/${locale}/pandas/${member.slug}` as Route}>{displayName(locale, member)}</Link>
                  <small>{member.birth_date ?? (locale === "zh" ? "出生日期未公开" : "Birth date unpublished")} · {member.status}</small>
                  <div className={styles.directory}>
                    <Link href={`/${locale}/pandas/${member.slug}` as Route}>{t.profile}</Link>
                    <Link href={`/${locale}/moments?panda=${member.slug}` as Route}>{t.moments}</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section} id="chapters" aria-labelledby="chapters-title">
            <div className={styles.sectionHeader}>
              <div><p className={styles.eyebrow}>02 · Reviewed chapters</p><h2 id="chapters-title">{t.chapters}</h2></div>
              <p>{locale === "zh" ? "章节引用稳定 ID；撤回成员、事件或关系后，故事必须重新投影。" : "Chapters reference stable IDs; withdrawing a member, event, or relationship requires the story to be reprojected."}</p>
            </div>
            <ol className={styles.chapterList}>
              {story.chapters.map((chapter, index) => {
                const chapterContent = localizedEditorial(chapter.localized_content, locale);
                return (
                  <li className={styles.chapter} key={chapter.id}>
                    <div className={styles.chapterMeta}>{String(index + 1).padStart(2, "0")} · {chapter.kind.replaceAll("_", " ")}</div>
                    <article>
                      <h3>{chapterContent.title}</h3>
                      <p>{chapterContent.summary}</p>
                      <div className={styles.pills}>
                        {chapter.member_ids.map((memberId) => {
                          const member = members.find((item) => item.id === memberId);
                          return member ? <Link key={member.id} className={styles.pill} href={`/${locale}/pandas/${member.slug}` as Route}>{displayName(locale, member)}</Link> : null;
                        })}
                        {chapter.event_ids.map((eventId) => <span className={`${styles.pill} ${styles.pillSecondary}`} key={eventId}>{eventId}</span>)}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className={styles.section} id="evidence" aria-labelledby="evidence-title">
            <div className={styles.sectionHeader}>
              <div><p className={styles.eyebrow}>03 · Evidence rail</p><h2 id="evidence-title">{t.evidence}</h2></div>
              <p>{locale === "zh" ? "关系状态、范围外依赖和媒体选择均显式呈现，不由页面叙事自动升级。" : "Relationship status, out-of-scope dependencies, and media selection remain explicit and are never upgraded by narrative placement."}</p>
            </div>
            <div className={styles.evidenceGrid}>
              <div>
                <details open>
                  <summary>{t.relationship}</summary>
                  <dl>
                    {assertions.map((assertion) => (
                      <div key={assertion.id} style={{ display: "contents" }}>
                        <dt>{assertion.status}</dt>
                        <dd>{relationshipLabel(locale, story, assertion.id, members)}<br /><code>{assertion.id}</code></dd>
                      </div>
                    ))}
                  </dl>
                </details>
                {story.scope.excluded_relationship_assertion_ids.length ? (
                  <details>
                    <summary>{t.excluded}</summary>
                    <ul>{story.scope.excluded_relationship_assertion_ids.map((assertionId) => <li key={assertionId}><code>{assertionId}</code></li>)}</ul>
                  </details>
                ) : null}
                <details>
                  <summary>{t.events}</summary>
                  <ul>{events.map((event) => <li key={event.id}><time dateTime={event.occurrenceDate}>{event.occurrenceDate}</time> · <code>{event.id}</code></li>)}</ul>
                </details>
              </div>
              <div>
                <details open>
                  <summary>{t.source}</summary>
                  <ul className={styles.sourceList}>
                    {sources.map((source) => <li key={source.id}><a href={source.url} rel="noreferrer">{source.title}</a><br /><small>{source.publisher} · {source.last_verified_at}</small></li>)}
                  </ul>
                </details>
                <details>
                  <summary>{locale === "zh" ? "继续探索" : "Continue exploring"}</summary>
                  <div className={styles.directory}>
                    <Link href={`/${locale}/families?view=lineage&focus=${members[0]?.slug ?? ""}` as Route}>{t.lineage}</Link>
                    <Link href={`/${locale}/moments?panda=${members[0]?.slug ?? ""}` as Route}>{t.moments}</Link>
                  </div>
                </details>
                {relatedStories.length ? (
                  <details>
                    <summary>{t.otherStories}</summary>
                    <div className={styles.directory}>{relatedStories.map((item) => { const itemContent = localizedEditorial(item.localized_content, locale); return <Link key={item.id} href={`/${locale}/families/${item.slug}` as Route}>{itemContent.title}</Link>; })}</div>
                  </details>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </main>
      <footer className={`${styles.shell} ${styles.footer}`}>{t.footer}</footer>
    </div>
  );
}
