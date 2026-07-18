import type { PublicEntityPageViewModel } from "@/components/patterns/public-entity-page";
import type {
  PublicContentEnvelope,
  PublicInstitutionRecord,
} from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";
import type { PandaDetail, PublicEntityName } from "@/lib/types";

function localizedName(names: PublicEntityName[], locale: PublicLocale): { display: string; alternate: string | null } {
  const language = locale === "zh" ? "zh-Hans" : "en";
  const otherLanguage = locale === "zh" ? "en" : "zh-Hans";
  const display = names.find((name) => name.language === language)?.value
    ?? names[0]?.value
    ?? "";
  const alternate = names.find((name) => name.language === otherLanguage)?.value ?? null;
  return { display, alternate: alternate === display ? null : alternate };
}

function pandaName(panda: PandaDetail, locale: PublicLocale): string {
  return locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
}

function dateRange(start: string, end: string | null, locale: PublicLocale): string {
  if (!end) return locale === "zh" ? `${start} 至今` : `${start} to present`;
  return `${start} – ${end}`;
}

export function buildInstitutionPageViewModel(
  envelope: PublicContentEnvelope<PublicInstitutionRecord>,
  locale: PublicLocale,
): PublicEntityPageViewModel {
  const { institution, places, pandas } = envelope.data;
  const name = localizedName(institution.names, locale);
  const facilityIds = new Set(institution.facility_ids);
  const currentPandas = pandas.filter((panda) =>
    Boolean(panda.current_place?.facility_id && facilityIds.has(panda.current_place.facility_id)),
  );
  const historicalPandas = pandas.filter((panda) =>
    !currentPandas.some((current) => current.id === panda.id)
    && panda.residencies.some((residency) =>
      Boolean(residency.facility_id && facilityIds.has(residency.facility_id)),
    ),
  );

  const pandaLink = (panda: PandaDetail, current: boolean) => {
    const residencies = panda.residencies.filter((residency) =>
      Boolean(residency.facility_id && facilityIds.has(residency.facility_id)),
    );
    const detail = residencies
      .map((residency) => `${dateRange(residency.start_date, residency.end_date, locale)} · ${residency.status}`)
      .join(locale === "zh" ? "；" : "; ");
    return {
      id: panda.id,
      name: pandaName(panda, locale),
      href: `/${locale}/atlas/${panda.slug}`,
      detail: `${current ? (locale === "zh" ? "当前" : "Current") : (locale === "zh" ? "历史" : "Historical")} · ${detail}`,
    };
  };

  const eventMap = new Map<string, PandaDetail["events"][number]>();
  for (const panda of pandas) {
    for (const event of panda.events) {
      if (
        (event.from_facility_id && facilityIds.has(event.from_facility_id))
        || (event.to_facility_id && facilityIds.has(event.to_facility_id))
      ) eventMap.set(event.id, event);
    }
  }
  const pandasById = new Map(pandas.map((panda) => [panda.id, panda]));
  const migrations = [...eventMap.values()]
    .sort((left, right) => left.event_date.localeCompare(right.event_date))
    .map((event) => {
      const arrival = Boolean(event.to_facility_id && facilityIds.has(event.to_facility_id));
      const departure = Boolean(event.from_facility_id && facilityIds.has(event.from_facility_id));
      const participants = event.participants
        .map((id) => pandasById.get(id))
        .filter((panda): panda is PandaDetail => Boolean(panda))
        .map((panda) => pandaName(panda, locale));
      const direction = arrival && departure
        ? locale === "zh" ? "机构内部记录" : "Within institution scope"
        : arrival
          ? locale === "zh" ? "迁入" : "Arrival"
          : locale === "zh" ? "迁出" : "Departure";
      return {
        id: event.id,
        date: event.event_date,
        status: event.event_status,
        title: `${direction} · ${participants.join(locale === "zh" ? "、" : ", ")}`,
        detail: event.changes_current_residency
          ? locale === "zh" ? "该已完成事件会改变当前驻留记录。" : "This completed event changes the current residency record."
          : locale === "zh" ? "该记录不会自动改变当前驻留。" : "This record does not automatically change current residency.",
        sourceIds: event.source_ids,
      };
    });

  const sourceIds = new Set(institution.source_ids);
  const revisionLocale = locale === "zh" ? "zh-CN" : "en";
  return {
    kind: "institution",
    stableId: institution.id,
    canonicalSlug: institution.canonical_slug,
    displayName: name.display,
    alternateName: name.alternate,
    typeLabel: institution.institution_type ?? (locale === "zh" ? "机构类型未公开" : "Institution type not published"),
    summary: locale === "zh"
      ? "查阅组织身份、关联场所、当前与历史熊猫驻留、迁移事件、公开来源和修订状态。"
      : "Review the organization identity, associated places, current and historical panda residencies, migration events, public sources, and revision state.",
    facts: [
      { label: locale === "zh" ? "稳定身份" : "Stable identity", value: institution.id },
      { label: locale === "zh" ? "机构类型" : "Institution type", value: institution.institution_type ?? "—" },
      { label: locale === "zh" ? "关联场所" : "Associated places", value: String(places.length) },
      { label: locale === "zh" ? "最后核实" : "Last verified", value: institution.last_verified_at ?? "—" },
    ],
    relatedEntities: places.map((place) => {
      const placeName = localizedName(place.names, locale);
      return {
        id: place.id,
        name: placeName.display,
        href: `/${locale}/places/${place.canonical_slug}`,
        detail: `${place.locality ?? "—"} · ${place.precision}`,
      };
    }),
    currentPandas: currentPandas.map((panda) => pandaLink(panda, true)),
    historicalPandas: historicalPandas.map((panda) => pandaLink(panda, false)),
    migrations,
    sources: envelope.sources
      .filter((source) => sourceIds.has(source.id))
      .map((source) => ({
        id: source.id,
        publisher: source.publisher,
        title: source.title,
        url: source.url,
        lastVerifiedAt: source.last_verified_at,
      })),
    revisionSummary: institution.revision_summaries.find((summary) => summary.locale === revisionLocale)?.summary ?? null,
    mapHref: `/${locale}/map?mode=institutions&focus=${encodeURIComponent(name.display)}&snapshot=${encodeURIComponent(envelope.release.id)}`,
    alternateLanguageHref: `/${locale === "zh" ? "en" : "zh"}/institutions/${institution.canonical_slug}`,
  };
}
