import type { components } from "@zhipanda/api-client";

type PandaSummary = components["schemas"]["PublicPandaSummaryDto"];

const ZH_TAGS = ["zh-Hans", "zh-CN", "zh"];

function primaryName(names: PandaSummary["names"], tags: string[]): string | null {
  for (const tag of tags) {
    const match = names.find((name) => name.languageTag === tag && name.isPrimary) ?? names.find((name) => name.languageTag === tag);
    if (match) return match.value;
  }
  return null;
}

export function chineseName(panda: PandaSummary): string | null {
  return primaryName(panda.names, ZH_TAGS);
}

export function englishName(panda: PandaSummary): string | null {
  return primaryName(panda.names, ["en"]);
}

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;
const HAN_ONLY = /^[\u3400-\u9fff\uf900-\ufaff]+$/;

/** The Han-only part of an imported name: "Kouhin / 幸浜" → 幸浜, "娅光 (Ya Ya" → 娅光. */
function hanPart(value: string): string | null {
  const sides = value.split(" / ").map((side) => side.trim());
  const side = sides.length > 1 ? sides.find((part) => HAN_ONLY.test(part)) : undefined;
  if (side) return side;
  const head = value.split(" (")[0]?.trim();
  return head && head !== value.trim() && HAN_ONLY.test(head) ? head : null;
}

/**
 * The Chinese name to show, cleaned for display only (the data is unchanged, docs/data/2026-10-31-name-cleanup-proposal.md).
 * Uses only spellings already in the panda's names, never a made-up one:
 * - "Kouhin / 幸浜" shows 幸浜, the data's own form (浜 stays 浜).
 * - "娅光 (Ya Ya", cut at a bracket on import, shows 娅光.
 * - "Tuan Tuan / 團團" shows the panda's one simplified alias 团团, when its Han part is not itself an alias
 *   and exactly one Han-only alias of the same length exists.
 * - A zh-Hans primary with no Han characters ("Happy") is not a Chinese name: null, so the English name shows.
 */
export function displayChineseName(panda: PandaSummary): string | null {
  const raw = chineseName(panda);
  if (!raw) return null;
  if (!HAN.test(raw)) return null;
  if (HAN_ONLY.test(raw)) return raw;
  const part = hanPart(raw);
  if (!part) return raw;
  const aliases = panda.names
    .filter((name) => ZH_TAGS.includes(name.languageTag) && !name.isPrimary && HAN_ONLY.test(name.value))
    .map((name) => name.value);
  if (aliases.includes(part)) return part;
  const sameLength = [...new Set(aliases.filter((alias) => alias.length === part.length))];
  const [only] = sameLength;
  return sameLength.length === 1 && only ? only : part;
}

export function displayName(panda: PandaSummary): string {
  return displayChineseName(panda) ?? englishName(panda) ?? panda.canonicalSlug;
}

function fact(panda: PandaSummary, key: string): unknown {
  return panda.facts.find((item) => item.fieldKey === key)?.value;
}

export function pandaSex(panda: PandaSummary): "male" | "female" | null {
  const value = fact(panda, "sex");
  return value === "male" || value === "female" ? value : null;
}

export function pandaBirthDate(panda: PandaSummary): string | null {
  const value = fact(panda, "birth_date");
  return typeof value === "string" && /^\d{4}/.test(value) ? value : null;
}

export function pandaIsDeceased(panda: PandaSummary): boolean {
  return fact(panda, "life_status") === "deceased";
}
