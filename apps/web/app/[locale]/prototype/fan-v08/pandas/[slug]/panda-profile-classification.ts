import type { PandaFactSource } from "./panda-fact-selection";

export type PandaProfileEra = "living" | "historical" | "unknown";

export type PandaLifeJourney =
  | "managed"
  | "wild_native"
  | "wild_rescued_in_care"
  | "wild_rescued_released"
  | "rewilding_training"
  | "rewilding_released"
  | "released_to_wild"
  | "unknown";

export interface PandaProfileClassification {
  era: PandaProfileEra;
  journey: PandaLifeJourney;
  evidenceFactIds: string[];
}

const managedCategories = new Set([
  "residence",
  "residency_history",
  "transfer",
  "husbandry",
  "husbandry_training",
  "enrichment",
  "public_debut",
  "diplomacy",
]);

const explicitReleasePredicate = /(?:released?_to_wild|wild_return|wild_release|translocated_release)/i;
const explicitRescueReleasePredicate = /wild_rescue_release/i;
const subjectRewildingPredicate = /(?:wild[_ -]?training_current|wildtraining_current|current_wildtraining|rewilding_training|reintroduction_candidate|named_wildtraining|bounded_wildtraining_identity|wild_training_observation)/i;
const subjectNativeWildPredicate = /(?:wild_tracking_identity|collared_wild_(?:female|male)_identity|wild_(?:female|male|individual)_identity)/i;

function factSearchText(fact: PandaFactSource): string {
  return `${fact.category} ${fact.predicate} ${fact.text}`;
}

function matchingFactIds(facts: PandaFactSource[], predicate: (fact: PandaFactSource) => boolean): string[] {
  return facts.filter(predicate).map((fact) => fact.id);
}

export function classifyPandaProfile({
  facts,
  lifeStatus,
  deathDate,
}: {
  facts: PandaFactSource[];
  lifeStatus: string | null | undefined;
  deathDate?: string | null;
}): PandaProfileClassification {
  const era: PandaProfileEra = deathDate || lifeStatus === "deceased"
    ? "historical"
    : lifeStatus === "alive"
      ? "living"
      : "unknown";

  const rescueIds = matchingFactIds(
    facts,
    (fact) => fact.category === "rescue"
      || explicitRescueReleasePredicate.test(fact.predicate)
      || (fact.category === "release" && /野生救护|wild[- ]rescued/i.test(fact.text)),
  );
  const releaseIds = matchingFactIds(
    facts,
    (fact) => fact.category === "release"
      || explicitReleasePredicate.test(fact.predicate)
      || explicitRescueReleasePredicate.test(fact.predicate)
      || (fact.category === "conservation" && /released_to_wild/i.test(fact.predicate)),
  );
  const rewildingIds = matchingFactIds(
    facts,
    (fact) => subjectRewildingPredicate.test(fact.predicate)
      || ((fact.category === "training" || fact.category === "conservation")
        && /野化培训|rewilding training/i.test(factSearchText(fact))
        && !/maternal_role|mother_led|mother_cub/i.test(fact.predicate)),
  );
  const nativeWildIds = matchingFactIds(
    facts,
    (fact) => fact.category === "wild_monitoring"
      || subjectNativeWildPredicate.test(fact.predicate),
  );
  const managedIds = matchingFactIds(facts, (fact) => managedCategories.has(fact.category));

  let journey: PandaLifeJourney = "unknown";
  let evidenceFactIds: string[] = [];

  if (rescueIds.length && releaseIds.length) {
    journey = "wild_rescued_released";
    evidenceFactIds = [...rescueIds, ...releaseIds, ...nativeWildIds];
  } else if (rescueIds.length) {
    journey = "wild_rescued_in_care";
    evidenceFactIds = rescueIds;
  } else if (rewildingIds.length && releaseIds.length) {
    journey = "rewilding_released";
    evidenceFactIds = [...rewildingIds, ...releaseIds, ...nativeWildIds];
  } else if (rewildingIds.length) {
    journey = "rewilding_training";
    evidenceFactIds = rewildingIds;
  } else if (releaseIds.length) {
    // A release is real evidence, but without origin/training evidence we do not guess
    // whether the panda was wild-rescued or captive-born for reintroduction.
    journey = "released_to_wild";
    evidenceFactIds = [...releaseIds, ...nativeWildIds];
  } else if (nativeWildIds.length && !managedIds.length) {
    journey = "wild_native";
    evidenceFactIds = nativeWildIds;
  } else if (managedIds.length) {
    journey = "managed";
    evidenceFactIds = managedIds;
  }

  return {
    era,
    journey,
    evidenceFactIds: [...new Set(evidenceFactIds)],
  };
}
