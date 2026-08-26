import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonPrimitive = string | number | boolean | null;
export interface JsonObject {
  [key: string]: JsonValue;
}

export type PandaNameKind =
  | "official"
  | "official_romanization"
  | "pinyin"
  | "alias"
  | "historic_spelling"
  | "historical_name"
  | "nickname";
export type FactCertainty = "confirmed" | "provisional";
export type FactConclusionStatus = "confirmed" | "provisional" | "disputed" | "superseded";

export interface PandaName {
  languageTag: string;
  nameKind: PandaNameKind;
  value: string;
  isPrimary: boolean;
  sourceIds: string[];
}

export interface PandaExternalIdentifier {
  system: string;
  value: string;
  sourceIds: string[];
}

export interface PandaFactConclusion {
  fieldKey: string;
  value?: JsonValue;
  status: FactConclusionStatus;
  lastVerifiedOn: string;
  candidateValues: JsonValue[];
  supersededValues: JsonValue[];
  conclusionVersion: number;
}

export interface PandaRecord {
  pandaId: string;
  canonicalSlug: string;
  legacySlugs: string[];
  names: PandaName[];
  externalIdentifiers: PandaExternalIdentifier[];
  conclusions: PandaFactConclusion[];
}

export interface CreatePandaInput {
  canonicalSlug: string;
  primaryName: {
    languageTag: string;
    value: string;
    nameKind?: PandaNameKind;
    sourceIds: string[];
  };
}

export interface AddPandaNameInput {
  pandaId: string;
  languageTag: string;
  nameKind: PandaNameKind;
  value: string;
  isPrimary?: boolean;
  validFrom?: string;
  validTo?: string;
  sourceIds: string[];
}

export interface AddExternalIdentifierInput {
  pandaId: string;
  system: string;
  value: string;
  sourceIds: string[];
}

export interface RecordFactAssertionInput {
  assertionId: string;
  pandaId: string;
  fieldKey: string;
  value: JsonValue;
  certainty: FactCertainty;
  lastVerifiedOn: string;
  sourceIds: string[];
  supersedesAssertionId?: string;
}

export interface SetFactConclusionInput {
  pandaId: string;
  fieldKey: string;
  value?: JsonValue;
  status: FactConclusionStatus;
  lastVerifiedOn: string;
  candidateValues?: JsonValue[];
  supersededValues?: JsonValue[];
  assertionIds: string[];
}

export interface CuratedPandaFactInput {
  assertionId: string;
  pandaId: string;
  fieldKey: string;
  value: JsonValue;
  certainty: FactCertainty;
  lastVerifiedOn: string;
  sourceIds: string[];
}

export interface PandaCurationParticipant {
  applyCuratedFact(transaction: DatabaseTransaction, input: CuratedPandaFactInput): Promise<void>;
}

export interface PandaRepository {
  createPanda(input: CreatePandaInput): Promise<PandaRecord>;
  getPanda(idOrSlug: string): Promise<PandaRecord | undefined>;
  exists(pandaId: string): Promise<boolean>;
  changeCanonicalSlug(pandaId: string, canonicalSlug: string, changedOn: string): Promise<void>;
  addName(input: AddPandaNameInput): Promise<PandaName>;
  addExternalIdentifier(input: AddExternalIdentifierInput): Promise<PandaExternalIdentifier>;
  recordFactAssertion(input: RecordFactAssertionInput): Promise<void>;
  setFactConclusion(input: SetFactConclusionInput): Promise<PandaFactConclusion>;
}

export type PandaPort = PandaRepository;
export interface PandaReferencePort {
  exists(pandaId: string): Promise<boolean>;
}

export const PANDA_REPOSITORY = Symbol("PANDA_REPOSITORY");
export const PANDA_PORT = Symbol("PANDA_PORT");
export const PANDA_REFERENCE_PORT = Symbol("PANDA_REFERENCE_PORT");
export const PANDA_CURATION_PARTICIPANT = Symbol("PANDA_CURATION_PARTICIPANT");

export function normalizeIdentityTerm(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export class PandaApplication implements PandaPort, PandaReferencePort {
  public constructor(private readonly repository: PandaRepository) {}

  public createPanda(input: CreatePandaInput): Promise<PandaRecord> {
    if (input.primaryName.sourceIds.length === 0) {
      throw new Error("A Panda primary name requires at least one evidence source");
    }
    return this.repository.createPanda(input);
  }

  public getPanda(idOrSlug: string): Promise<PandaRecord | undefined> {
    return this.repository.getPanda(idOrSlug);
  }

  public exists(pandaId: string): Promise<boolean> {
    return this.repository.exists(pandaId);
  }

  public changeCanonicalSlug(pandaId: string, canonicalSlug: string, changedOn: string): Promise<void> {
    return this.repository.changeCanonicalSlug(pandaId, canonicalSlug, changedOn);
  }

  public addName(input: AddPandaNameInput): Promise<PandaName> {
    if (input.sourceIds.length === 0) {
      throw new Error("Panda names require at least one evidence source");
    }
    return this.repository.addName(input);
  }

  public addExternalIdentifier(input: AddExternalIdentifierInput): Promise<PandaExternalIdentifier> {
    if (input.sourceIds.length === 0) {
      throw new Error("Panda external identifiers require at least one evidence source");
    }
    return this.repository.addExternalIdentifier(input);
  }

  public recordFactAssertion(input: RecordFactAssertionInput): Promise<void> {
    if (input.sourceIds.length === 0) {
      throw new Error("Panda fact assertions require at least one evidence source");
    }
    return this.repository.recordFactAssertion(input);
  }

  public setFactConclusion(input: SetFactConclusionInput): Promise<PandaFactConclusion> {
    if (input.assertionIds.length === 0) {
      throw new Error("Panda fact conclusions require at least one assertion");
    }
    if (input.status === "disputed" && input.value !== undefined) {
      throw new Error("Disputed panda fact conclusions must not choose a single value");
    }
    return this.repository.setFactConclusion(input);
  }
}
