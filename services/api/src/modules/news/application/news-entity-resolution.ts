import type {
  PublicInstitutionSummary,
  PublicPandaSummary,
  PublicPlaceSummary,
  PublicResidencySummary,
} from "../../public-read/application/public-read.application.js";

export interface EntityReferenceCatalog {
  pandas: readonly PublicPandaSummary[];
  institutions: readonly PublicInstitutionSummary[];
  places: readonly PublicPlaceSummary[];
  residencies: readonly PublicResidencySummary[];
}

export interface ResolvedInstitutionRef {
  institutionId: string;
  slug: string;
  name: string;
}

export interface ResolvedPandaRef {
  pandaId: string;
  canonicalSlug: string;
  name: string;
  institutionIds: ReadonlySet<string>;
}

export interface EntityResolutionResult {
  institution: ResolvedInstitutionRef | undefined;
  toInstitution: ResolvedInstitutionRef | undefined;
  pandas: ResolvedPandaRef[];
  unresolvedPandaNames: string[];
  ambiguousPandaNames: string[];
}

const SLUG_YEAR_SUFFIX = /-\d{4}$/;

const EXTRA_INSTITUTION_SLUGS: ReadonlyArray<[string, string]> = [
  ["成都基地", "chengdu-research-base"],
  ["成都熊猫基地", "chengdu-research-base"],
  ["熊猫谷", "chengdu-research-base"],
  ["都江堰熊猫谷", "chengdu-research-base"],
  ["熊猫中心", "ccrcgp"],
  ["神树坪", "ccrcgp"],
  ["神树坪基地", "ccrcgp"],
  ["雅安碧峰峡", "ccrcgp"],
  ["卧龙", "ccrcgp"],
  ["北动", "beijing-zoo"],
  ["重动", "chongqing-zoo"],
  ["上野", "ueno-zoo"],
  ["上野动物园", "ueno-zoo"],
  ["爱宝乐园", "everland"],
  ["三星爱宝", "everland"],
  ["红山动物园", "nanjing-hongshan-zoo"],
  ["香港海洋公园", "ocean-park-hong-kong"],
];

const EXTRA_PANDA_SLUGS: ReadonlyArray<[string, string]> = [
  ["花花", "he-hua-chengdu"],
  ["果赖", "he-hua-chengdu"],
];

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hostnameOf(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function primaryPandaName(panda: PublicPandaSummary): string {
  const zh = panda.names.find((name) => name.languageTag.startsWith("zh") && name.isPrimary);
  return zh?.value ?? panda.names[0]?.value ?? panda.canonicalSlug;
}

function institutionLabel(institution: PublicInstitutionSummary): string {
  return institution.nameZh ?? institution.nameEn ?? institution.slug;
}

export interface NewsEntityResolver {
  resolveItem(input: {
    sourceTier: string;
    sourceUrl: string;
    authorInstitutionSlug?: string;
    institutionName?: string;
    toPlaceName?: string;
    pandaNames: readonly string[];
  }): EntityResolutionResult;
  resolvePandaSlugs(slugs: readonly string[]): ResolvedPandaRef[];
  resolveInstitutionSlug(slug: string): ResolvedInstitutionRef | undefined;
}

export function createNewsEntityResolver(catalog: EntityReferenceCatalog): NewsEntityResolver {
  const placeToInstitutionId = new Map<string, string>();
  for (const place of catalog.places) {
    if (place.institutionId !== undefined) {
      placeToInstitutionId.set(place.placeId, place.institutionId);
    }
  }

  const instBySlug = new Map<string, ResolvedInstitutionRef>();
  const instAliasIndex = new Map<string, ResolvedInstitutionRef>();
  const instDomainIndex = new Map<string, ResolvedInstitutionRef>();
  const instPhrases: Array<{ alias: string; ref: ResolvedInstitutionRef }> = [];

  for (const inst of catalog.institutions) {
    const ref: ResolvedInstitutionRef = {
      institutionId: inst.institutionId,
      slug: inst.slug,
      name: institutionLabel(inst),
    };
    instBySlug.set(inst.slug, ref);
    for (const key of [inst.slug, inst.nameZh, inst.nameEn]) {
      if (!key) continue;
      const normalized = normalizeKey(key);
      instAliasIndex.set(normalized, ref);
      if (normalized.length >= 3) {
        instPhrases.push({ alias: normalized, ref });
      }
    }
    const host = hostnameOf(inst.profile?.websiteUrl);
    if (
      host &&
      !host.includes("weibo.") &&
      !host.includes("xiaohongshu.") &&
      !host.includes("douyin.") &&
      !host.includes("wikipedia.") &&
      !host.includes("wikidata.") &&
      !host.includes("douban.") &&
      !host.includes("baidu.")
    ) {
      instDomainIndex.set(host, ref);
    }
  }

  for (const [alias, slug] of EXTRA_INSTITUTION_SLUGS) {
    const ref = instBySlug.get(slug);
    if (ref !== undefined) {
      const normalized = normalizeKey(alias);
      instAliasIndex.set(normalized, ref);
      instPhrases.push({ alias: normalized, ref });
    }
  }
  instPhrases.sort((a, b) => b.alias.length - a.alias.length);

  const pandaBySlug = new Map<string, ResolvedPandaRef>();
  const strongNameIndex = new Map<string, ResolvedPandaRef[]>();
  const weakNameIndex = new Map<string, ResolvedPandaRef[]>();

  const addIndex = (map: Map<string, ResolvedPandaRef[]>, key: string, ref: ResolvedPandaRef) => {
    const normalized = normalizeKey(key);
    if (normalized.length < 2) return;
    const list = map.get(normalized) ?? [];
    if (!list.some((item) => item.pandaId === ref.pandaId)) {
      list.push(ref);
      map.set(normalized, list);
    }
  };

  for (const panda of catalog.pandas) {
    const institutionIds = new Set<string>();
    if (panda.currentPlace !== undefined) {
      const instId = placeToInstitutionId.get(panda.currentPlace.placeId);
      if (instId !== undefined) institutionIds.add(instId);
    }
    for (const residency of catalog.residencies) {
      if (residency.pandaId === panda.pandaId) {
        const instId = placeToInstitutionId.get(residency.placeId);
        if (instId !== undefined) institutionIds.add(instId);
      }
    }

    const ref: ResolvedPandaRef = {
      pandaId: panda.pandaId,
      canonicalSlug: panda.canonicalSlug,
      name: primaryPandaName(panda),
      institutionIds,
    };
    pandaBySlug.set(panda.canonicalSlug, ref);
    for (const legacySlug of panda.legacySlugs) {
      pandaBySlug.set(legacySlug, ref);
    }
    for (const name of panda.names) {
      addIndex(strongNameIndex, name.value, ref);
    }
    addIndex(strongNameIndex, panda.canonicalSlug, ref);

    const romanized = panda.canonicalSlug.replace(SLUG_YEAR_SUFFIX, "").replaceAll("-", " ");
    if (romanized.length >= 4) {
      addIndex(weakNameIndex, romanized, ref);
    }
  }

  for (const [alias, slug] of EXTRA_PANDA_SLUGS) {
    const ref = pandaBySlug.get(slug);
    if (ref !== undefined) {
      addIndex(strongNameIndex, alias, ref);
    }
  }

  const resolveInstitution = (
    rawName: string | undefined,
    sourceUrl?: string,
  ): ResolvedInstitutionRef | undefined => {
    if (rawName) {
      const normalized = normalizeKey(rawName);
      const exact = instAliasIndex.get(normalized);
      if (exact !== undefined) return exact;
      const substr = instPhrases.find(({ alias }) => normalized.includes(alias));
      if (substr !== undefined) return substr.ref;
    }
    const host = hostnameOf(sourceUrl);
    if (host !== undefined) {
      const direct = instDomainIndex.get(host);
      if (direct !== undefined) return direct;
      for (const [domain, ref] of instDomainIndex.entries()) {
        if (host.endsWith(`.${domain}`)) return ref;
      }
    }
    return undefined;
  };

  return {
    resolveItem(input) {
      const authorInst =
        input.sourceTier === "institution" && input.authorInstitutionSlug
          ? instBySlug.get(input.authorInstitutionSlug)
          : undefined;
      const institution = authorInst ?? resolveInstitution(input.institutionName, input.sourceUrl);
      const toInstitution = resolveInstitution(input.toPlaceName);

      const contextInstitutionIds = new Set<string>();
      if (institution !== undefined) contextInstitutionIds.add(institution.institutionId);
      if (toInstitution !== undefined) contextInstitutionIds.add(toInstitution.institutionId);

      const resolvedPandas: ResolvedPandaRef[] = [];
      const unresolvedPandaNames: string[] = [];
      const ambiguousPandaNames: string[] = [];

      for (const rawName of input.pandaNames) {
        const cleaned = rawName.trim();
        if (!cleaned) continue;
        const normalized = normalizeKey(cleaned);
        const strongHits = strongNameIndex.get(normalized) ?? [];
        const weakHits = strongHits.length === 0 ? (weakNameIndex.get(normalized) ?? []) : [];
        const candidates = strongHits.length > 0 ? strongHits : weakHits;
        const usedWeakFallback = strongHits.length === 0 && weakHits.length > 0;

        if (candidates.length === 0) {
          unresolvedPandaNames.push(cleaned);
          continue;
        }

        if (candidates.length === 1) {
          const only = candidates[0]!;
          if (
            usedWeakFallback &&
            contextInstitutionIds.size > 0 &&
            only.institutionIds.size > 0 &&
            ![...contextInstitutionIds].some((id) => only.institutionIds.has(id))
          ) {
            unresolvedPandaNames.push(cleaned);
            continue;
          }
          if (!resolvedPandas.some((item) => item.pandaId === only.pandaId)) {
            resolvedPandas.push(only);
          }
          continue;
        }

        if (contextInstitutionIds.size > 0) {
          const filtered = candidates.filter((candidate) =>
            [...contextInstitutionIds].some((id) => candidate.institutionIds.has(id)),
          );
          if (filtered.length === 1) {
            const match = filtered[0]!;
            if (!resolvedPandas.some((item) => item.pandaId === match.pandaId)) {
              resolvedPandas.push(match);
            }
            continue;
          }
        }

        ambiguousPandaNames.push(cleaned);
        unresolvedPandaNames.push(cleaned);
      }

      return {
        institution,
        toInstitution,
        pandas: resolvedPandas,
        unresolvedPandaNames,
        ambiguousPandaNames,
      };
    },

    resolvePandaSlugs(slugs) {
      const seen = new Set<string>();
      const out: ResolvedPandaRef[] = [];
      for (const raw of slugs) {
        const ref = pandaBySlug.get(raw.trim());
        if (ref !== undefined && !seen.has(ref.pandaId)) {
          seen.add(ref.pandaId);
          out.push(ref);
        }
      }
      return out;
    },

    resolveInstitutionSlug(slug) {
      return instBySlug.get(slug.trim());
    },
  };
}
