import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import {
  loadV2PublicLineageDataset,
  
  type PublicCoverage,
} from "@/features/public-content/public-v2";
import {
  familyStoryMembers,
  listFamilyStories,
  localizedEditorial,
  publicExperienceRelease,
} from "@/features/public-experiences/data";
import styles from "@/features/public-experiences/public-experiences.module.css";
import {
  familyLineageHref,
  parseLineageQuery,
  type LineageFocusReference,
} from "@/features/lineage/lineage-query";
import { StructuredLineagePage } from "@/features/lineage/structured-lineage-page";
import { buildStructuredLineageViewModel } from "@/features/lineage/lineage-view-model";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface FamiliesPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const copy = {
  zh: {
    title: "熊猫家族",
    description: "从家族故事认识熊猫，再用谱系图查看父母、子女、兄弟姐妹与更早祖辈。",
    eyebrow: "Panda Families · 家族",
    dek: "故事负责把关系讲清楚，谱系负责把关系查清楚。两种视图共享同一批已发布熊猫、关系和来源。",
    stories: "家族故事",
    lineage: "谱系图",
    members: "成员",
    open: "打开故事",
    release: "公开版本",
    scope: "声明范围",
    partial: "部分范围",
    complete: "范围内完整",
    empty: "当前公开版本还没有家族故事。",
  },
  en: {
    title: "Panda Families",
    description: "Meet panda families through stories, then inspect parents, children, siblings, and earlier generations in the lineage view.",
    eyebrow: "Panda Families",
    dek: "Stories make relationships understandable; lineage makes them inspectable. Both views use the same published pandas, relationships, and sources.",
    stories: "Family stories",
    lineage: "Lineage",
    members: "members",
    open: "Open story",
    release: "Public release",
    scope: "Declared scope",
    partial: "Partial scope",
    complete: "Complete in scope",
    empty: "There are no family stories in the current public release.",
  },
} as const;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: Pick<FamiliesPageProps, "params">): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({ locale, title: `${t.title} | ${locale === "zh" ? "吱熊猫" : "ZhiPanda"}`, description: t.description, path: "/families" });
}

export default async function FamiliesPage({ params, searchParams }: FamiliesPageProps) {
  const [{ locale: rawLocale }, rawSearch] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const view = one(rawSearch.view) === "lineage" ? "lineage" : "stories";

  if (view === "lineage") {
    const envelope = await loadV2PublicLineageDataset(locale);
    if (!envelope) notFound();
    const defaultNode = envelope.data.nodes.find((node) => node.profile_available) ?? envelope.data.nodes[0];
    if (!defaultNode) notFound();
    const defaultFocus: LineageFocusReference = { id: defaultNode.id, slug: defaultNode.slug };
    const resolveFocus = (input: string): LineageFocusReference | null => {
      const published = envelope.data.nodes.find((node) => node.id === input || node.slug === input || node.search_terms?.includes(input));
      if (published && envelope.data.nodes.some((node) => node.id === published.id)) return published;
      const direct = envelope.data.nodes.find((node) => node.id === input || node.slug === input);
      return direct ? { id: direct.id, slug: direct.slug } : null;
    };
    const lineageSearch = {
      focus: rawSearch.focus,
      ancestors: rawSearch.ancestors,
      descendants: rawSearch.descendants,
      relation: rawSearch.relation,
    };
    const parsed = parseLineageQuery(lineageSearch, resolveFocus, defaultFocus);
    const initialView = buildStructuredLineageViewModel(
      envelope.data.nodes,
      envelope.data.parentageAssertions,
      envelope.sources,
      parsed.state,
      locale,
    );
    const relation = parsed.state.relation && initialView.validRelationIds.has(parsed.state.relation)
      ? parsed.state.relation
      : "";
    const canonicalState = { ...parsed.state, relation };
    if (parsed.needsNormalization || relation !== parsed.state.relation) {
      permanentRedirect(familyLineageHref(locale, canonicalState) as Route);
    }
    const lineageView = relation === parsed.state.relation
      ? initialView
      : buildStructuredLineageViewModel(
          envelope.data.nodes,
          envelope.data.parentageAssertions,
          envelope.sources,
          canonicalState,
          locale,
        );
    const coverage: PublicCoverage = lineageView.hasPartialRecords
      ? {
          state: "partial",
          scope: "reviewed lineage scope containing partial identities, tentative assertions, or inaccessible sources",
        }
      : envelope.coverage;

    return (
      <StructuredLineagePage
        locale={locale}
        state={canonicalState}
        view={lineageView}
        release={envelope.release}
        delivery={envelope.delivery}
        coverage={coverage}
        localeDelivery={envelope.locale}
      />
    );
  }

  const stories = listFamilyStories();
  const t = copy[locale];
  const alternateLocale = locale === "zh" ? "en" : "zh";

  return (
    <div className={styles.page}>
      <GlobalNavigation locale={locale} active="families" alternatePath={`/${alternateLocale}/families`} />
      <main id="main-content">
        <div className={styles.shell}>
          <p className={styles.releaseNote}>
            {t.release}: {publicExperienceRelease.dataset_release_version} · Schema {publicExperienceRelease.public_schema_version}
          </p>
          <section className={styles.hero} aria-labelledby="families-title">
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h1 className={styles.title} id="families-title">{t.title}</h1>
            <p className={styles.dek}>{t.dek}</p>
            <nav className={styles.directory} aria-label={locale === "zh" ? "家族视图" : "Family views"}>
              <Link href={`/${locale}/families` as Route} aria-current="page">{t.stories}</Link>
              <Link href={`/${locale}/families?view=lineage` as Route}>{t.lineage}</Link>
            </nav>
          </section>

          <section className={styles.section} aria-labelledby="family-stories-title">
            <div className={styles.sectionHeader}>
              <div><p className={styles.eyebrow}>01 · Stories</p><h2 id="family-stories-title">{t.stories}</h2></div>
              <p>{locale === "zh" ? "每个故事都有明确范围，叙事不会自动升级关系证据。" : "Every story has an explicit scope; narrative placement never upgrades relationship evidence."}</p>
            </div>
            {stories.length ? (
              <div className={styles.members}>
                {stories.map((story) => {
                  const content = localizedEditorial(story.localized_content, locale);
                  const members = familyStoryMembers(story);
                  return (
                    <article className={styles.member} key={story.id}>
                      <p className={styles.eyebrow}>{story.scope.coverage_state === "partial" ? t.partial : t.complete}</p>
                      <h3><Link href={`/${locale}/families/${story.slug}` as Route}>{content.title}</Link></h3>
                      <p>{content.summary}</p>
                      <small>{t.scope}: {story.scope.coverage_state} · {members.length} {t.members}</small>
                      <div className={styles.pills} aria-label={t.members}>
                        {members.slice(0, 8).map((member) => (
                          <Link key={member.id} className={styles.pill} href={`/${locale}/pandas/${member.slug}` as Route}>
                            {locale === "zh" ? member.name_zh : member.name_en ?? member.name_zh}
                          </Link>
                        ))}
                      </div>
                      <div className={styles.directory}>
                        <Link href={`/${locale}/families/${story.slug}` as Route}>{t.open}</Link>
                        {members[0] ? <Link href={`/${locale}/families?view=lineage&focus=${members[0].slug}` as Route}>{t.lineage}</Link> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <p className={styles.empty}>{t.empty}</p>}
          </section>
        </div>
      </main>
    </div>
  );
}
