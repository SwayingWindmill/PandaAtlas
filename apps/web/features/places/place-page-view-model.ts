import type { PublicEntityPageViewModel } from "@/components/patterns/public-entity-page";
import type {
  PublicContentEnvelope,
  PublicPlaceRecord,
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

export function buildPlacePageViewModel(
  envelope: PublicContentEnvelope<PublicPlaceRecord>,
  locale: PublicLocale,
): PublicEntityPageViewModel {
  const { place, institutions, pandas } = envelope.data;
  const name = localizedName(place.names, locale);
  const facilityIds = new Set(place.facility_ids);
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
      const participants = event.participants
        .map((id) => pandasById.get(id))
        .filter((panda): panda is PandaDetail => Boolean(panda))
        .map((panda) => pandaName(panda, locale));
      return {
        id: event.id,
        date: event.event_date,
        status: event.event_status,
        title: `${arrival ? (locale === "zh" ? "迁入" : "Arrival") : (locale === "zh" ? "迁出" : "Departure")} · ${participants.join(locale === "zh" ? "、" : ", ")}`,
        detail: event.changes_current_residency
          ? locale === "zh" ? "该事件会改变当前驻留记录。" : "This event changes the current residency record."
          : locale === "zh" ? "该记录不会自动改变当前驻留。" : "This record does not automatically change current residency.",
        sourceIds: event.source_ids,
      };
    });

  const sourceIds = new Set(place.source_ids);
  const revisionLocale = locale === "zh" ? "zh-CN" : "en";
  return {
    kind: "place",
    stableId: place.id,
    canonicalSlug: place.canonical_slug,
    displayName: name.display,
    alternateName: name.alternate,
    typeLabel: place.place_type ?? (locale === "zh" ? "场所类型未公开" : "Place type not published"),
    summary: locale === "zh"
      ? "查阅物理场所身份、公开位置精度、所属机构、熊猫驻留、迁移记录、来源和修订状态。"
      : "Review the physical place identity, published location precision, associated institution, panda residencies, migration records, sources, and revision state.",
    facts: [
      { label: locale === "zh" ? "稳定身份" : "Stable identity", value: place.id },
      { label: locale === "zh" ? "国家" : "Country", value: place.country_code ?? "—" },
      { label: locale === "zh" ? "公开地区" : "Published locality", value: place.locality ?? "—" },
      { label: locale === "zh" ? "公开精度" : "Published precision", value: place.precision },
      { label: locale === "zh" ? "最后核实" : "Last verified", value: place.last_verified_at ?? "—" },
    ],
    relatedEntities: institutions.map((institution) => {
      const institutionName = localizedName(institution.names, locale);
      return {
        id: institution.id,
        name: institutionName.display,
        href: `/${locale}/institutions/${institution.canonical_slug}`,
        detail: institution.institution_type ?? "—",
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
    revisionSummary: place.revision_summaries.find((summary) => summary.locale === revisionLocale)?.summary ?? null,
    mapHref: `/${locale}/map?mode=institutions&focus=${encodeURIComponent(name.display)}&snapshot=${encodeURIComponent(envelope.release.id)}`,
    alternateLanguageHref: `/${locale === "zh" ? "en" : "zh"}/places/${place.canonical_slug}`,
  };
}
