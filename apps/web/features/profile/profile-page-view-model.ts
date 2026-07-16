import type { PandaDetail, PublicFactConclusion } from "@/lib/types";
import type { PublicLocale } from "@/foundation/content/locales";
import { publicLanguageTag } from "@/foundation/content/locales";
import type { PublicTranslationState } from "@/features/public-content/public-release";

export interface TrustedProfileFactViewModel {
  field: "life_status" | "birth_date" | "sex" | "current_coarse_location";
  value: unknown | null;
  status: PublicFactConclusion["status"] | "unknown";
  lastVerifiedAt: string | null;
  sourceIds: string[];
  precision: "day" | "country" | "categorical" | "unknown";
}

export interface TrustedProfilePageViewModel {
  stableId: string;
  canonicalSlug: string;
  displayName: string;
  displayNameLanguage: "zh-CN" | "en";
  displayNameTranslation: PublicTranslationState;
  alternateName: string | null;
  summary: string | null;
  recordTier: string | null;
  facts: TrustedProfileFactViewModel[];
  atlasHref: string;
  alternateLanguageHref: string;
}

function conclusionFor(panda: PandaDetail, field: string): PublicFactConclusion | undefined {
  return panda.conclusions.find((conclusion) => conclusion.field === field);
}

function fact(
  panda: PandaDetail,
  field: TrustedProfileFactViewModel["field"],
  fallback: unknown | null,
  precision: TrustedProfileFactViewModel["precision"],
): TrustedProfileFactViewModel {
  const conclusion = conclusionFor(panda, field);
  return {
    field,
    value: conclusion?.value ?? fallback,
    status: conclusion?.status ?? "unknown",
    lastVerifiedAt: conclusion?.last_verified_at ?? null,
    sourceIds: conclusion?.source_ids ?? [],
    precision,
  };
}

export function buildTrustedProfilePageViewModel(
  panda: PandaDetail,
  locale: PublicLocale,
): TrustedProfilePageViewModel {
  if (!panda.identity) {
    throw new Error("A trusted profile view model requires a reviewed identity.");
  }

  const requestedContentLocale = publicLanguageTag(locale);
  const summary = panda.localized_content.find(
    (item) => item.locale === requestedContentLocale,
  )?.summary ?? null;
  const otherLocale = locale === "zh" ? "en" : "zh";
  const hasReviewedEnglishName = Boolean(panda.name_en);
  const displayName = locale === "zh" || !hasReviewedEnglishName
    ? panda.name_zh
    : panda.name_en!;

  return {
    stableId: panda.identity.stable_id,
    canonicalSlug: panda.identity.canonical_slug,
    displayName,
    displayNameLanguage: locale === "en" && !hasReviewedEnglishName ? "zh-CN" : requestedContentLocale,
    displayNameTranslation: locale === "en" && !hasReviewedEnglishName ? "missing" : "reviewed",
    alternateName: locale === "zh" ? panda.name_en : panda.name_zh,
    summary,
    recordTier: panda.record_tier,
    facts: [
      fact(panda, "life_status", panda.status, "categorical"),
      fact(panda, "birth_date", panda.birth_date, panda.birth_date ? "day" : "unknown"),
      fact(panda, "sex", panda.gender, "categorical"),
      fact(
        panda,
        "current_coarse_location",
        panda.current_place?.coarse_location ?? panda.current_location,
        panda.current_place?.status === "confirmed_country_level" ? "country" : "unknown",
      ),
    ],
    atlasHref: `/${locale}/atlas`,
    alternateLanguageHref: `/${otherLocale}/atlas/${panda.identity.canonical_slug}`,
  };
}
