import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { LearningApplication } from "../../learning/application/learning.application.js";
import type { PublicPandaSummary, PublicReadPort } from "../../publication/application/public-read.application.js";
import {
  type AskIndexedDocument,
  type AskPandaFacts,
  type AskSourceLink,
  learningDocuments,
  pandaDocument,
  withContentHash,
} from "../application/ask-corpus.js";
import type { AskCorpusSource } from "../application/ask.ports.js";

// Only these facts are indexed. The many local.* facts carry curation notes, not answers.
const CORE_FACTS = [
  "sex",
  "birth_date",
  "birth_date_precision",
  "birthplace",
  "life_status",
  "death_date",
  "current_facility",
  "current_coarse_location",
];
const SHOWN_STATUSES = new Set(["confirmed", "provisional"]);

function primaryName(panda: Pick<PublicPandaSummary, "names">, language: "zh" | "en"): string | null {
  const names = panda.names.filter((name) => (language === "zh" ? name.languageTag.startsWith("zh") : name.languageTag === "en"));
  return (names.find((name) => name.isPrimary) ?? names[0])?.value ?? null;
}

function stringFact(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Builds the 问问熊猫 corpus from published learning entries and deliverable panda facts. */
export class PostgresAskCorpus implements AskCorpusSource {
  public constructor(
    private readonly database: DatabaseService,
    private readonly learning: Pick<LearningApplication, "published">,
    private readonly publicRead: Pick<PublicReadPort, "listPandas" | "listLineage" | "listResidencies" | "listPlaces">,
  ) {}

  public async documents(): Promise<AskIndexedDocument[]> {
    const catalog = await this.learning.published();
    const documents = learningDocuments(catalog);
    documents.push(...(await this.pandaDocuments()));
    return documents.map(withContentHash);
  }

  private async pandaDocuments() {
    const [pandas, lineage, residencies, places] = await Promise.all([
      this.publicRead.listPandas(),
      this.publicRead.listLineage(),
      this.publicRead.listResidencies(),
      this.publicRead.listPlaces(),
    ]);
    // A suspended or missing release leaves no panda passages; the sync then removes them.
    if (pandas.kind !== "ok" || lineage.kind !== "ok" || residencies.kind !== "ok" || places.kind !== "ok") return [];
    const releaseId = pandas.value.release.releaseId;
    const deliverable = new Map(pandas.value.items.map((panda) => [panda.pandaId, panda]));
    const placeById = new Map(places.value.items.map((place) => [place.placeId, place]));

    const rows = await this.database.db
      .selectFrom("public_read.pandas")
      .select(["panda_id", "facts", "evidence_source_ids"])
      .where("release_id", "=", releaseId)
      .execute();
    const evidence = await this.deliverableEvidence(releaseId);

    return rows.flatMap((row) => {
      const panda = deliverable.get(row.panda_id);
      if (panda === undefined) return [];
      const facts = new Map<string, { value: unknown; status: string }>();
      for (const fact of (Array.isArray(row.facts) ? row.facts : []) as { fieldKey?: unknown; value?: unknown; status?: unknown }[]) {
        if (typeof fact.fieldKey !== "string" || !CORE_FACTS.includes(fact.fieldKey)) continue;
        if (typeof fact.status !== "string" || !SHOWN_STATUSES.has(fact.status)) continue;
        facts.set(fact.fieldKey, { value: fact.value, status: fact.status });
      }
      const parents = lineage.value.items.filter((item) => item.childId === row.panda_id);
      const offspring = lineage.value.items.filter((item) => item.parentId === row.panda_id);
      const homes = residencies.value.items.filter((item) => item.pandaId === row.panda_id);
      const sourceIds = new Set<string>(row.evidence_source_ids);
      for (const item of [...parents, ...offspring]) for (const id of item.sourceIds) sourceIds.add(id);
      for (const item of homes) for (const id of item.sourceIds) sourceIds.add(id);
      const sources = [...sourceIds].flatMap((id) => {
        const source = evidence.get(id);
        return source === undefined ? [] : [source];
      });

      const facts_: AskPandaFacts = {
        slug: panda.canonicalSlug,
        nameZh: primaryName(panda, "zh"),
        nameEn: primaryName(panda, "en"),
        sex: stringFact(facts.get("sex")?.value),
        birthDate: stringFact(facts.get("birth_date")?.value),
        birthDatePrecision: stringFact(facts.get("birth_date_precision")?.value),
        birthplace: stringFact(facts.get("birthplace")?.value),
        lifeStatus: stringFact(facts.get("life_status")?.value),
        deathDate: stringFact(facts.get("death_date")?.value),
        currentFacility: stringFact(facts.get("current_facility")?.value),
        currentLocation: stringFact(facts.get("current_coarse_location")?.value),
        parents: parents.flatMap((item) => {
          const parent = deliverable.get(item.parentId);
          return parent === undefined ? [] : [{ role: item.parentRole, nameZh: primaryName(parent, "zh"), nameEn: primaryName(parent, "en") }];
        }),
        children: offspring.flatMap((item) => {
          const child = deliverable.get(item.childId);
          return child === undefined ? [] : [{ nameZh: primaryName(child, "zh"), nameEn: primaryName(child, "en") }];
        }),
        residencies: homes.flatMap((item) => {
          const place = placeById.get(item.placeId);
          return place === undefined
            ? []
            : [{ placeZh: place.nameZh ?? null, placeEn: place.nameEn ?? null, startOn: item.startOn ?? null, endOn: item.endOn ?? null }];
        }),
        provisional: [...facts.entries()].filter(([, fact]) => fact.status === "provisional").map(([key]) => key),
        sources,
      };
      const document = pandaDocument(facts_);
      return document === null ? [] : [document];
    });
  }

  // Evidence sources of the release minus those under a current takedown.
  private async deliverableEvidence(releaseId: string): Promise<Map<string, AskSourceLink>> {
    const [rows, controls] = await Promise.all([
      this.database.db
        .selectFrom("public_read.evidence_sources")
        .select(["source_id", "publisher", "title", "url", "access_state"])
        .where("release_id", "=", releaseId)
        .execute(),
      this.database.db
        .selectFrom("publication.delivery_control_events")
        .select(["resource_id", "action"])
        .where("control_kind", "=", "resource_takedown")
        .where("resource_kind", "=", "evidence")
        .orderBy("occurred_at", "desc")
        .orderBy("control_event_id", "desc")
        .execute(),
    ]);
    const latest = new Map<string, string>();
    for (const control of controls) {
      if (control.resource_id !== null && !latest.has(control.resource_id)) latest.set(control.resource_id, control.action);
    }
    return new Map(
      rows
        .filter((row) => latest.get(row.source_id) !== "apply" && /^https?:\/\//u.test(row.url))
        .map((row) => [row.source_id, { title: row.title, publisher: row.publisher, url: row.url }]),
    );
  }
}
