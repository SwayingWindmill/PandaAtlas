// Institutions are not published by V2 yet, so this page still reads the reviewed V1 snapshot.
import {
  TRUSTED_INSTITUTIONS,
  TRUSTED_PANDA_DETAILS,
  TRUSTED_PLACES,
} from "@/lib/generated/trusted-identity-aliases";
import type { PandaDetail } from "@/lib/types";
import type { PublicLocale } from "@/foundation/content/locales";
import { publicLanguageTag } from "@/foundation/content/locales";
import {
  applyFrontendWithdrawal,
  resolveActiveFrontendWithdrawal,
} from "@/features/public-content/frontend-withdrawal";
import type {
  PublicContentEnvelope,
  PublicCoverage,
  PublicInstitutionRecord,
  PublicLocaleDelivery,
  PublicReleaseIdentity,
} from "@/features/public-content/public-release";

const reviewedDetails = [...TRUSTED_PANDA_DETAILS].sort((left, right) =>
  left.name_zh.localeCompare(right.name_zh, "zh-CN"),
);
const canonicalDetails = applyFrontendWithdrawal(reviewedDetails, resolveActiveFrontendWithdrawal(reviewedDetails));

function normalizeSearchTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[\s_\-:]+/g, "")
    .trim();
}

function releaseIdentity(detail: PandaDetail): PublicReleaseIdentity {
  return {
    id: detail.public_revision?.data_version ?? "unknown-public-release",
    schemaVersion: detail.public_revision?.public_schema_version ?? "unknown-public-schema",
  };
}

function lastSuccessfulAt(details: PandaDetail[]): string | null {
  const values = details.flatMap((detail) =>
    detail.sources.map((source) => source.last_verified_at).filter(Boolean),
  );
  return values.sort().at(-1) ?? null;
}

function localeDelivery(detail: PandaDetail, locale: PublicLocale): PublicLocaleDelivery {
  const requiredLocale = publicLanguageTag(locale);
  const available = detail.localized_content.flatMap((item) => {
    if (item.locale === "zh-CN") return ["zh" as const];
    if (item.locale === "en") return ["en" as const];
    return [];
  });

  return {
    requested: locale,
    available: [...new Set(available)],
    translation: detail.localized_content.some((item) => item.locale === requiredLocale)
      ? "reviewed"
      : "missing",
  };
}

function buildEnvelope<T>(
  data: T,
  details: PandaDetail[],
  locale: PublicLocale,
  coverage: PublicCoverage,
): PublicContentEnvelope<T> {
  const primary = details[0] ?? canonicalDetails[0];
  if (!primary) {
    throw new Error("The trusted public release contains no panda records.");
  }

  const sources = [...new Map(
    details.flatMap((detail) => detail.sources).map((source) => [source.id, source]),
  ).values()];

  return {
    data,
    release: releaseIdentity(primary),
    delivery: {
      state: "cached",
      label: "versioned-local-public-release",
      lastSuccessfulAt: lastSuccessfulAt(details),
    },
    coverage,
    locale: localeDelivery(primary, locale),
    sources,
  };
}

function resolveEntityReference<T extends { id: string; canonical_slug: string; legacy_slugs: string[] }>(
  records: readonly T[],
  input: string,
): { id: string; slug: string } | null {
  const normalized = normalizeSearchTerm(input);
  if (!normalized) return null;
  const record = records.find((candidate) =>
    candidate.id === input
    || normalizeSearchTerm(candidate.canonical_slug) === normalized
    || candidate.legacy_slugs.some((slug) => normalizeSearchTerm(slug) === normalized),
  );
  return record ? { id: record.id, slug: record.canonical_slug } : null;
}

function pandasLinkedToFacilities(facilityIds: readonly string[]): PandaDetail[] {
  const ids = new Set(facilityIds);
  return canonicalDetails.filter((panda) =>
    panda.residencies.some((residency) => residency.facility_id && ids.has(residency.facility_id))
    || panda.events.some((event) =>
      (event.from_facility_id && ids.has(event.from_facility_id))
      || (event.to_facility_id && ids.has(event.to_facility_id)),
    ),
  );
}

export function resolvePublishedInstitutionReference(input: string): { id: string; slug: string } | null {
  return resolveEntityReference(TRUSTED_INSTITUTIONS, input);
}

export function loadPublishedInstitution(
  input: string,
  locale: PublicLocale,
): PublicContentEnvelope<PublicInstitutionRecord> | null {
  const reference = resolvePublishedInstitutionReference(input);
  if (!reference) return null;
  const institution = TRUSTED_INSTITUTIONS.find((item) => item.id === reference.id);
  if (!institution || institution.source_ids.length === 0) return null;
  const pandas = pandasLinkedToFacilities(institution.facility_ids);
  return buildEnvelope(
    {
      institution,
      places: TRUSTED_PLACES.filter((place) => institution.place_ids.includes(place.id)),
      pandas,
    },
    pandas,
    locale,
    {
      state: "complete",
      scope: "reviewed institution identity, places, panda residencies, migrations, sources, and revision state",
    },
  );
}
