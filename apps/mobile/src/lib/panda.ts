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

export function displayName(panda: PandaSummary): string {
  return chineseName(panda) ?? englishName(panda) ?? panda.canonicalSlug;
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
