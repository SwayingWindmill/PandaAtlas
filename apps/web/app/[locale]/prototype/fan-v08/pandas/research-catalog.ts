import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

interface ResearchCatalogMedia {
  url: string;
  credit: string | null;
  rights: string | null;
  source_url: string | null;
  media_id: string | null;
}

export interface ResearchCatalogPanda {
  id: string;
  slug: string;
  label: string;
  name_zh: string;
  name_en: string | null;
  gender: "male" | "female" | "unknown";
  status: "alive" | "deceased" | "unknown";
  birth_year: string | null;
  record_count: number;
  direct_record_count: number;
  source_family_count: number;
  individual_media_count: number;
  p0_status: Record<string, string>;
  media: ResearchCatalogMedia | null;
}

export interface ResearchCatalog {
  schema_version: number;
  generated_at: string;
  scope: string;
  summary: {
    subject_count: number;
    subjects_with_confirmed_media: number;
    subjects_without_confirmed_media: number;
    direct_zero_subject_count: number;
  };
  pandas: ResearchCatalogPanda[];
}

const CATALOG_RELATIVE_PATH = ".ai-bridge/fan-v08-research-catalog.json";

async function readCatalogAt(path: string): Promise<ResearchCatalog | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as ResearchCatalog;
  } catch {
    return null;
  }
}

export async function loadFanV08ResearchCatalog(force = false): Promise<ResearchCatalog | null> {
  if (!force && process.env.FAN_V08_RESEARCH_CATALOG !== "1") return null;

  const candidates = [
    resolve(process.cwd(), "../../", CATALOG_RELATIVE_PATH),
    resolve(process.cwd(), CATALOG_RELATIVE_PATH),
  ];

  for (const candidate of candidates) {
    const catalog = await readCatalogAt(candidate);
    if (catalog) return catalog;
  }
  return null;
}
