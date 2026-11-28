import type { PublicLearningCatalog } from "../../catalog/application/learning-catalog.js";
import type { PublicPandaSummary, PublicReadPort } from "../../public-read/application/public-read.application.js";
import {
  type AskIndexedDocument,
  type AskPandaFacts,
  type AskSourceLink,
  learningDocuments,
  pandaDocument,
  withContentHash,
} from "./ask-corpus.js";
import type { AskCorpusSource } from "./ask.ports.js";

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

/** Builds the 问问熊猫 corpus through owner ports without cross-schema queries. */
export class PublicReadAskCorpus implements AskCorpusSource {
  public constructor(
    private readonly learning: { published(): Promise<PublicLearningCatalog> },
    private readonly publicRead: Pick<
      PublicReadPort,
      "listPandas" | "listLineage" | "listResidencies" | "listPlaces" | "getDeliverableCorpusSources"
    >,
  ) {}

  public async documents(): Promise<AskIndexedDocument[]> {
    const catalog = await this.learning.published();
    const documents = learningDocuments(catalog);
    documents.push(...(await this.pandaDocuments()));
    return documents.map(withContentHash);
  }

  private async pandaDocuments() {
    const [pandas, lineage, residencies, places, corpus] = await Promise.all([
      this.publicRead.listPandas(),
      this.publicRead.listLineage(),
      this.publicRead.listResidencies(),
      this.publicRead.listPlaces(),
      this.publicRead.getDeliverableCorpusSources(),
    ]);
    // A suspended or missing release leaves no panda passages; the sync then removes them.
    if (
      pandas.kind !== "ok" ||
      lineage.kind !== "ok" ||
      residencies.kind !== "ok" ||
      places.kind !== "ok" ||
      corpus.kind !== "ok"
    ) {
      return [];
    }
    const releaseId = pandas.value.release.releaseId;
    if (
      lineage.value.release.releaseId !== releaseId ||
      residencies.value.release.releaseId !== releaseId ||
      places.value.release.releaseId !== releaseId ||
      corpus.value.release.releaseId !== releaseId
    ) {
      return [];
    }

    const deliverable = new Map(pandas.value.items.map((panda) => [panda.pandaId, panda]));
    const placeById = new Map(places.value.items.map((place) => [place.placeId, place]));
    const evidence = new Map<string, AskSourceLink>(
      corpus.value.evidence
        .filter((source) => /^https?:\/\//u.test(source.url))
        .map((source) => [source.sourceId, { title: source.title, publisher: source.publisher, url: source.url }]),
    );

    return corpus.value.pandas.flatMap((bundle) => {
      const panda = deliverable.get(bundle.pandaId);
      if (panda === undefined) return [];
      const facts = new Map<string, { value: unknown; status: string }>();
      for (const fact of bundle.facts) {
        if (!CORE_FACTS.includes(fact.fieldKey) || !SHOWN_STATUSES.has(fact.status)) continue;
        facts.set(fact.fieldKey, { value: fact.value, status: fact.status });
      }
      const parents = lineage.value.items.filter((item) => item.childId === bundle.pandaId);
      const offspring = lineage.value.items.filter((item) => item.parentId === bundle.pandaId);
      const homes = residencies.value.items.filter((item) => item.pandaId === bundle.pandaId);
      const sourceIds = new Set<string>(bundle.evidenceSourceIds);
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
}
