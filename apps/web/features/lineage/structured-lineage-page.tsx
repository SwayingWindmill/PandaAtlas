import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, GitBranch, Network, SearchCheck } from "lucide-react";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import type {
  PublicCoverage,
  PublicDelivery,
  PublicLocaleDelivery,
  PublicReleaseIdentity,
} from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";
import { lineageHref, type LineageQueryState } from "./lineage-query";
import type {
  StructuredLineageRelation,
  StructuredLineageSection,
  StructuredLineageViewModel,
} from "./lineage-view-model";

interface StructuredLineagePageProps {
  locale: PublicLocale;
  state: LineageQueryState;
  view: StructuredLineageViewModel;
  release: PublicReleaseIdentity;
  delivery: PublicDelivery;
  coverage: PublicCoverage;
  localeDelivery: PublicLocaleDelivery;
}

const copy = {
  zh: {
    title: "结构化熊猫谱系",
    description: "无需依赖图形，按已审核亲本断言查证父母、子女、兄弟姐妹、代际方向、证据状态和来源。",
    focus: "当前个体",
    ancestorDepth: "向上代数",
    descendantDepth: "向下代数",
    apply: "更新谱系范围",
    focusProfile: "打开当前个体档案",
    noGraphTitle: "图形不是完成任务的前提",
    noGraphBody: "本页面先提供完整的结构化关系路径。图形探索将在后续增强切片中加入，失败时不会影响这里的关系和来源。",
    scope: (nodes: number, relations: number, up: number, down: number) =>
      `当前范围包含 ${nodes} 个稳定身份、${relations} 条结构化关系；向上 ${up} 代，向下 ${down} 代。`,
    partial: "范围内包含部分档案、暂定关系或当前不可访问来源，页面不会将其显示为已确认完整事实。",
    complete: "当前范围内的关系均使用已发布断言表达。",
    selected: "已选关系",
    clearSelection: "清除关系选择",
    path: "关系路径",
    direction: "方向",
    generation: "代际",
    role: "亲本角色",
    evidence: "证据来源",
    assertions: "断言标识",
    profile: "打开可信档案",
    profileUnavailable: "该依赖身份尚无可访问的完整档案",
    inspect: "查看此关系",
    sourceUnavailable: "来源链接当前不可用",
    noRelations: "当前已发布范围内没有此类关系。这表示未发布，而不是现实中确定不存在。",
    parents: "父母",
    ancestors: "更早祖辈",
    siblings: "兄弟姐妹",
    children: "子女",
    descendants: "更后代",
    parent: "父母关系",
    ancestor: "祖辈关系",
    sibling: "兄弟姐妹关系",
    child: "子女关系",
    descendant: "后代关系",
    up: "向上",
    down: "向下",
    lateral: "同代",
    father: "父亲",
    mother: "母亲",
    confirmed: "已确认",
    tentative: "暂定",
    disputed: "有争议",
    superseded: "已取代",
    unknown: "未知",
    generationLabel: (generation: number) => generation === 0
      ? "同代"
      : generation < 0
        ? `向上 ${Math.abs(generation)} 代`
        : `向下 ${generation} 代`,
    stableId: "稳定标识",
    sourceState: "访问状态",
    lastVerified: "最后核实",
  },
  en: {
    title: "Structured panda lineage",
    description: "Verify parents, children, siblings, generation direction, evidence status, and sources from reviewed parentage assertions without depending on a graph.",
    focus: "Focus panda",
    ancestorDepth: "Ancestor depth",
    descendantDepth: "Descendant depth",
    apply: "Update lineage scope",
    focusProfile: "Open focus profile",
    noGraphTitle: "A graph is not required to finish the task",
    noGraphBody: "This page provides the complete structured relationship path first. Graph exploration will arrive as a later enhancement and cannot remove these relationships or sources if it fails.",
    scope: (nodes: number, relations: number, up: number, down: number) =>
      `This scope contains ${nodes} stable identities and ${relations} structured relationships, ${up} generations up and ${down} generations down.`,
    partial: "The scope includes partial profiles, tentative relationships, or currently inaccessible sources; they are not presented as complete confirmed facts.",
    complete: "Relationships in the current scope are expressed through published assertions.",
    selected: "Selected relationship",
    clearSelection: "Clear relationship selection",
    path: "Relationship path",
    direction: "Direction",
    generation: "Generation",
    role: "Parent role",
    evidence: "Evidence sources",
    assertions: "Assertion identifiers",
    profile: "Open trusted profile",
    profileUnavailable: "This dependency identity does not yet have an accessible full profile",
    inspect: "Inspect this relationship",
    sourceUnavailable: "Source link currently unavailable",
    noRelations: "No relationship of this type is published in the current scope. This means unpublished, not proven absent in reality.",
    parents: "Parents",
    ancestors: "Earlier ancestors",
    siblings: "Siblings",
    children: "Children",
    descendants: "Later descendants",
    parent: "Parent relationship",
    ancestor: "Ancestor relationship",
    sibling: "Sibling relationship",
    child: "Child relationship",
    descendant: "Descendant relationship",
    up: "Up",
    down: "Down",
    lateral: "Same generation",
    father: "Father",
    mother: "Mother",
    confirmed: "Confirmed",
    tentative: "Tentative",
    disputed: "Disputed",
    superseded: "Superseded",
    unknown: "Unknown",
    generationLabel: (generation: number) => generation === 0
      ? "Same generation"
      : generation < 0
        ? `${Math.abs(generation)} generation${Math.abs(generation) === 1 ? "" : "s"} up`
        : `${generation} generation${generation === 1 ? "" : "s"} down`,
    stableId: "Stable identifier",
    sourceState: "Access state",
    lastVerified: "Last verified",
  },
} as const;

function relationState(state: LineageQueryState, relation: string): LineageQueryState {
  return { ...state, relation };
}

function relationLabel(
  relation: StructuredLineageRelation,
  locale: PublicLocale,
): string {
  const t = copy[locale];
  const kind = t[relation.kind];
  return `${kind}: ${relation.related.name}`;
}

function RelationCard({
  locale,
  state,
  relation,
}: {
  locale: PublicLocale;
  state: LineageQueryState;
  relation: StructuredLineageRelation;
}) {
  const t = copy[locale];
  return (
    <article
      id={`relation-${encodeURIComponent(relation.id)}`}
      className="pa-lineage-relation-card"
      data-state={relation.status}
      data-selected={relation.selected ? "true" : "false"}
      data-testid={`lineage-relation-${relation.id}`}
    >
      <header>
        <div>
          <p className="pa-result-kicker">{t.stableId}: {relation.related.id}</p>
          <h3 lang={relation.related.nameLanguage}>{relation.related.name}</h3>
          {relation.related.alternateName ? <p>{relation.related.alternateName}</p> : null}
        </div>
        <div className="pa-lineage-badges">
          <span>{t[relation.kind]}</span>
          <span data-status={relation.status}>{t[relation.status]}</span>
        </div>
      </header>

      <dl className="pa-lineage-relation-meta">
        <div><dt>{t.direction}</dt><dd>{t[relation.direction]}</dd></div>
        <div><dt>{t.generation}</dt><dd>{t.generationLabel(relation.generation)}</dd></div>
        {relation.role ? <div><dt>{t.role}</dt><dd>{t[relation.role]}</dd></div> : null}
      </dl>

      <div className="pa-lineage-path">
        <strong>{t.path}</strong>
        <ol>
          {relation.path.map((node) => <li key={`${relation.id}-${node.id}`} lang={node.nameLanguage}>{node.name}</li>)}
        </ol>
      </div>

      <div className="pa-lineage-assertions">
        <strong>{t.assertions}</strong>
        <ul>{relation.assertionIds.map((id) => <li key={id}><code>{id}</code></li>)}</ul>
      </div>

      <div className="pa-lineage-sources">
        <strong>{t.evidence}</strong>
        <ul>
          {relation.sources.map((source) => (
            <li key={source.id}>
              {source.url ? <a href={source.url}>{source.publisher}: {source.title}</a> : <span>{source.publisher}: {source.title}</span>}
              <small>{t.sourceState}: {source.accessState}{source.lastVerifiedAt ? ` · ${t.lastVerified}: ${source.lastVerifiedAt}` : ""}</small>
              {!source.url ? <em>{t.sourceUnavailable}</em> : null}
            </li>
          ))}
        </ul>
      </div>

      <footer>
        {relation.related.profileAvailable ? (
          <Link href={`/${locale}/atlas/${relation.related.slug}` as Route}>{t.profile}<ArrowRight aria-hidden="true" /></Link>
        ) : <span>{t.profileUnavailable}</span>}
        <Link
          href={lineageHref(locale, relationState(state, relation.id)) as Route}
          aria-current={relation.selected ? "true" : undefined}
        >
          {t.inspect}<SearchCheck aria-hidden="true" />
        </Link>
      </footer>
    </article>
  );
}

function LineageSectionView({
  locale,
  state,
  section,
}: {
  locale: PublicLocale;
  state: LineageQueryState;
  section: StructuredLineageSection;
}) {
  const t = copy[locale];
  const headingId = `lineage-${section.key}`;
  return (
    <section className="pa-lineage-section" aria-labelledby={headingId} data-testid={`lineage-section-${section.key}`}>
      <div className="pa-lineage-section-heading">
        <h2 id={headingId}>{t[section.key]}</h2>
        <span>{section.relations.length}</span>
      </div>
      {section.relations.length ? (
        <div className="pa-lineage-relation-list">
          {section.relations.map((relation) => (
            <RelationCard key={relation.id} locale={locale} state={state} relation={relation} />
          ))}
        </div>
      ) : <p className="pa-lineage-empty">{t.noRelations}</p>}
    </section>
  );
}

export function StructuredLineagePage({
  locale,
  state,
  view,
  release,
  delivery,
  coverage,
  localeDelivery,
}: StructuredLineagePageProps) {
  const t = copy[locale];
  const alternateLocale = locale === "zh" ? "en" : "zh";
  const selected = view.selectedRelation;

  return (
    <>
      <GlobalNavigation
        locale={locale}
        active="lineage"
        alternatePath={lineageHref(alternateLocale, state)}
      />
      <main id="main-content" className="pa-public-main" data-testid="structured-lineage-page">
        <section className={`${publicShellClassName} pa-lineage-hero`}>
          <p className="pa-eyebrow">PandaAtlas / Reviewed relationships</p>
          <h1>{t.title}</h1>
          <p className="pa-lede">{t.description}</p>

          <form action={`/${locale}/lineage`} method="get" className="pa-lineage-scope-form" aria-label={t.apply}>
            <label>{t.focus}
              <select name="focus" defaultValue={state.focusSlug}>
                {view.focusOptions.map((node) => (
                  <option key={node.id} value={node.slug}>{node.name}{node.alternateName ? ` · ${node.alternateName}` : ""}</option>
                ))}
              </select>
            </label>
            <label>{t.ancestorDepth}
              <select name="ancestors" defaultValue={String(state.ancestorDepth)}>
                {[1, 2, 3, 4].map((depth) => <option key={depth} value={depth}>{depth}</option>)}
              </select>
            </label>
            <label>{t.descendantDepth}
              <select name="descendants" defaultValue={String(state.descendantDepth)}>
                {[1, 2, 3, 4].map((depth) => <option key={depth} value={depth}>{depth}</option>)}
              </select>
            </label>
            <button type="submit">{t.apply}</button>
          </form>
        </section>

        <section className={`${publicShellClassName} pa-section pa-lineage-content`}>
          <PublicDeliveryNotice
            locale={locale}
            release={release}
            delivery={delivery}
            coverage={coverage}
            localeDelivery={localeDelivery}
          />

          <section className="pa-lineage-focus" aria-labelledby="lineage-focus-heading">
            <div>
              <p className="pa-eyebrow">{t.focus}</p>
              <h2 id="lineage-focus-heading" lang={view.focus.nameLanguage}>{view.focus.name}</h2>
              {view.focus.alternateName ? <p>{view.focus.alternateName}</p> : null}
              <code>{view.focus.id}</code>
            </div>
            {view.focus.profileAvailable ? (
              <Link href={`/${locale}/atlas/${view.focus.slug}` as Route}>{t.focusProfile}<ArrowRight aria-hidden="true" /></Link>
            ) : null}
          </section>

          <div className="pa-lineage-summary-grid">
            <article>
              <Network aria-hidden="true" />
              <h2>{t.noGraphTitle}</h2>
              <p>{t.noGraphBody}</p>
            </article>
            <article>
              <GitBranch aria-hidden="true" />
              <h2>{t.scope(view.scopedNodeCount, view.totalRelations, state.ancestorDepth, state.descendantDepth)}</h2>
              <p>{view.hasPartialRecords ? t.partial : t.complete}</p>
            </article>
          </div>

          {selected ? (
            <aside className="pa-lineage-selected" data-testid="selected-lineage-relation" aria-label={t.selected}>
              <div>
                <strong>{t.selected}</strong>
                <p>{relationLabel(selected, locale)} · {t[selected.status]} · {t.generationLabel(selected.generation)}</p>
              </div>
              <Link href={lineageHref(locale, relationState(state, "")) as Route}>{t.clearSelection}</Link>
            </aside>
          ) : null}

          <div className="pa-lineage-sections">
            {view.sections.map((section) => (
              <LineageSectionView key={section.key} locale={locale} state={state} section={section} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
