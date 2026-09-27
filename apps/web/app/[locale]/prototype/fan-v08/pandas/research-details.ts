import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export interface ResearchDetailCore {
  birth_date?: string;
  sex?: string;
  birthplace?: string;
  studbook_number?: string | number;
  life_status?: string;
  death_date?: string;
}

export interface ResearchDetailRelation {
  id: string;
  kind: string;
  target_subject_id: string | null;
  target_label: string | null;
  target_slug: string | null;
  target_name_zh: string | null;
  target_name_en: string | null;
  summary_zh: string | null;
  summary_en: string | null;
  source_id: string | null;
  parentage_status?: string | null;
}

export interface ResearchDetailMoment {
  id: string;
  date: string;
  category: string;
  predicate: string;
  summary_zh: string | null;
  summary_en: string | null;
  source_id: string | null;
}

export interface ResearchDetailHighlight {
  id: string;
  category: string;
  predicate: string;
  summary_zh: string | null;
  summary_en: string | null;
  source_id: string | null;
}

export interface ResearchDetailFact extends ResearchDetailHighlight {
  date: string | null;
}

export interface ResearchDetailClassificationEvidence {
  id: string;
  category: string;
  predicate: string;
}

export interface ResearchDetailMedia {
  id: string;
  url: string;
  credit: string | null;
  rights: string | null;
  source_url: string | null;
  captured_at: string | null;
  description: string | null;
}

export interface ResearchDetailSource {
  id: string;
  publisher: string;
  title: string;
  url: string;
  source_type: string | null;
  authority: string | null;
  source_family: string | null;
  retrieved_at: string | null;
}

export interface ResearchDetailPanda {
  id: string;
  canonical_research_id: string;
  slug: string;
  label: string | null;
  core: ResearchDetailCore;
  relations: ResearchDetailRelation[];
  moments: ResearchDetailMoment[];
  highlights: ResearchDetailHighlight[];
  facts?: ResearchDetailFact[];
  classification_evidence?: ResearchDetailClassificationEvidence[];
  media: ResearchDetailMedia[];
  sources: ResearchDetailSource[];
}

export interface ResearchDetailCatalog {
  schema_version: number;
  generated_at: string;
  scope: string;
  summary: {
    catalog_subject_count: number;
    matched_catalog_subject_count: number;
    subjects_with_safe_direct_records: number;
    subjects_with_relations: number;
    subjects_with_timeline: number;
    subjects_with_confirmed_media: number;
  };
  subjects: Record<string, ResearchDetailPanda>;
}

let cached: ResearchDetailCatalog | null | undefined;

function detailCatalogPath(): string {
  return path.resolve(process.cwd(), "../../.ai-bridge/fan-v08-research-details.json");
}

export async function loadFanV08ResearchDetails(force = false): Promise<ResearchDetailCatalog | null> {
  if (!force && cached !== undefined) return cached;

  try {
    const payload = JSON.parse(await readFile(detailCatalogPath(), "utf8")) as ResearchDetailCatalog;
    const value = payload?.schema_version >= 1 && payload.subjects ? payload : null;
    if (!force) cached = value;
    return value;
  } catch {
    if (!force) cached = null;
    return null;
  }
}
