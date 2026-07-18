import type { Route } from "next";
import Link from "next/link";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import type {
  PublicCoverage,
  PublicDelivery,
  PublicLocaleDelivery,
  PublicReleaseIdentity,
} from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";

export interface PublicEntityLinkViewModel {
  id: string;
  name: string;
  href: string;
  detail: string;
}

export interface PublicEntityTimelineViewModel {
  id: string;
  date: string;
  status: string;
  title: string;
  detail: string;
  sourceIds: string[];
}

export interface PublicEntitySourceViewModel {
  id: string;
  publisher: string;
  title: string;
  url: string;
  lastVerifiedAt: string;
}

export interface PublicEntityPageViewModel {
  kind: "institution" | "place";
  stableId: string;
  canonicalSlug: string;
  displayName: string;
  alternateName: string | null;
  typeLabel: string;
  summary: string;
  facts: Array<{ label: string; value: string }>;
  relatedEntities: PublicEntityLinkViewModel[];
  currentPandas: PublicEntityLinkViewModel[];
  historicalPandas: PublicEntityLinkViewModel[];
  migrations: PublicEntityTimelineViewModel[];
  sources: PublicEntitySourceViewModel[];
  revisionSummary: string | null;
  mapHref: string;
  alternateLanguageHref: string;
}

interface PublicEntityPageProps {
  locale: PublicLocale;
  entity: PublicEntityPageViewModel;
  release: PublicReleaseIdentity;
  delivery: PublicDelivery;
  coverage: PublicCoverage;
  localeDelivery: PublicLocaleDelivery;
}

const copy = {
  zh: {
    institution: "机构实体",
    place: "场所实体",
    evidence: "可信公开实体",
    distinctionInstitution: "这是组织记录。实际物理场所单独列出，不把机构名称当作精确居住点。",
    distinctionPlace: "这是物理场所记录。所属机构单独列出，不把场所当作组织。",
    identity: "身份与公开范围",
    relatedInstitution: "关联场所",
    relatedPlace: "关联机构",
    current: "当前关联熊猫",
    historical: "历史关联熊猫",
    migrations: "迁移事件",
    sources: "公开来源",
    revision: "版本与修订",
    noCurrent: "当前没有已发布的现居关联。",
    noHistorical: "当前没有已发布的历史关联。",
    noMigrations: "当前没有已发布的迁移事件。",
    noRelated: "当前没有已发布的跨实体关系。",
    noRevision: "当前语言没有已发布的修订摘要。",
    openMap: "在结构化地图中查看",
    sourceVerified: "最后核实",
  },
  en: {
    institution: "Institution entity",
    place: "Place entity",
    evidence: "Trusted public entity",
    distinctionInstitution: "This is an organization record. Physical places are listed separately; an institution name is not treated as an exact residence.",
    distinctionPlace: "This is a physical place record. Institutions are listed separately; the place is not presented as an organization.",
    identity: "Identity and published scope",
    relatedInstitution: "Associated places",
    relatedPlace: "Associated institutions",
    current: "Current associated pandas",
    historical: "Historical associated pandas",
    migrations: "Migration events",
    sources: "Public sources",
    revision: "Version and revision",
    noCurrent: "No published current-residency association is available.",
    noHistorical: "No published historical association is available.",
    noMigrations: "No published migration event is available.",
    noRelated: "No published cross-entity relationship is available.",
    noRevision: "No revision summary is published in this language.",
    openMap: "Open in the structured map",
    sourceVerified: "Last verified",
  },
} as const;

function LinkList({ items, empty }: { items: PublicEntityLinkViewModel[]; empty: string }) {
  if (!items.length) return <p>{empty}</p>;
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.id} className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <Link href={item.href as Route} className="break-words font-semibold text-[var(--accent-strong)] [overflow-wrap:anywhere] hover:underline">
            {item.name}
          </Link>
          <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function PublicEntityPage({
  locale,
  entity,
  release,
  delivery,
  coverage,
  localeDelivery,
}: PublicEntityPageProps) {
  const t = copy[locale];
  const isInstitution = entity.kind === "institution";
  return (
    <>
      <GlobalNavigation locale={locale} active="map" alternatePath={entity.alternateLanguageHref} />
      <main id="main-content" className="pb-20 pt-8" data-testid={`${entity.kind}-entity-page`}>
        <div className={`${publicShellClassName} grid min-w-0 gap-8 [&>*]:min-w-0`}>
          <header className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-10">
            <p className="pa-eyebrow">{t.evidence} · {isInstitution ? t.institution : t.place}</p>
            <h1 className="mt-3 break-words text-4xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-6xl">{entity.displayName}</h1>
            {entity.alternateName ? <p className="mt-2 text-lg text-[var(--muted)]">{entity.alternateName}</p> : null}
            <p className="mt-5 max-w-3xl text-lg leading-8">{entity.summary}</p>
            <p className="mt-5 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm leading-6">
              {isInstitution ? t.distinctionInstitution : t.distinctionPlace}
            </p>
          </header>

          <PublicDeliveryNotice
            locale={locale}
            release={release}
            delivery={delivery}
            coverage={coverage}
            localeDelivery={localeDelivery}
          />

          <section aria-labelledby="entity-identity-heading" className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
            <p className="pa-eyebrow">{entity.typeLabel}</p>
            <h2 id="entity-identity-heading" className="mt-2 text-2xl font-semibold">{t.identity}</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {entity.facts.map((fact) => (
                <div key={fact.label} className="rounded-2xl bg-[var(--surface-muted)] p-4">
                  <dt className="text-sm font-semibold text-[var(--muted)]">{fact.label}</dt>
                  <dd className="mt-1 break-words [overflow-wrap:anywhere]">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <Link href={entity.mapHref as Route} className="mt-6 inline-flex font-semibold text-[var(--accent-strong)] hover:underline">
              {t.openMap}
            </Link>
          </section>

          <section aria-labelledby="entity-related-heading">
            <h2 id="entity-related-heading" className="text-2xl font-semibold">
              {isInstitution ? t.relatedInstitution : t.relatedPlace}
            </h2>
            <div className="mt-4"><LinkList items={entity.relatedEntities} empty={t.noRelated} /></div>
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="entity-current-heading">
              <h2 id="entity-current-heading" className="text-2xl font-semibold">{t.current}</h2>
              <div className="mt-4"><LinkList items={entity.currentPandas} empty={t.noCurrent} /></div>
            </section>
            <section aria-labelledby="entity-historical-heading">
              <h2 id="entity-historical-heading" className="text-2xl font-semibold">{t.historical}</h2>
              <div className="mt-4"><LinkList items={entity.historicalPandas} empty={t.noHistorical} /></div>
            </section>
          </div>

          <section aria-labelledby="entity-migration-heading">
            <h2 id="entity-migration-heading" className="text-2xl font-semibold">{t.migrations}</h2>
            {entity.migrations.length ? (
              <ol className="mt-4 grid gap-3">
                {entity.migrations.map((event) => (
                  <li key={event.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-semibold text-[var(--muted)]">{event.date} · {event.status}</p>
                    <h3 className="mt-1 font-semibold">{event.title}</h3>
                    <p className="mt-1 text-sm">{event.detail}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-4">{t.noMigrations}</p>}
          </section>

          <section aria-labelledby="entity-sources-heading" className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
            <h2 id="entity-sources-heading" className="text-2xl font-semibold">{t.sources}</h2>
            <ul className="mt-4 grid gap-4">
              {entity.sources.map((source) => (
                <li key={source.id} id={source.id} className="min-w-0">
                  <a href={source.url} target="_blank" rel="noreferrer" className="break-words font-semibold text-[var(--accent-strong)] [overflow-wrap:anywhere] hover:underline">
                    {source.publisher}: {source.title}
                  </a>
                  <p className="text-sm text-[var(--muted)]">{t.sourceVerified}: {source.lastVerifiedAt}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="entity-revision-heading" className="rounded-[2rem] bg-[var(--surface-muted)] p-6">
            <h2 id="entity-revision-heading" className="text-xl font-semibold">{t.revision}</h2>
            <p className="mt-2">{entity.revisionSummary ?? t.noRevision}</p>
            <p className="mt-2 break-words text-sm text-[var(--muted)] [overflow-wrap:anywhere]">{release.id} · Public Schema {release.schemaVersion} · {entity.stableId}</p>
          </section>
        </div>
      </main>
    </>
  );
}
