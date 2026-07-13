import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CORE_PANDA_SLUGS = [
  "mei-xiang",
  "tian-tian",
  "tai-shan",
  "bao-bao",
  "bei-bei",
  "xiao-qi-ji",
  "bao-li",
];

export const GOLDEN_DATASET_CONSUMERS = [
  "domain",
  "api",
  "projection",
  "snapshot",
  "browser",
];

const RECORD_COLLECTIONS = [
  "sources",
  "facilities",
  "related_pandas",
  "pandas",
  "facts",
  "parentage_assertions",
  "residencies",
  "events",
  "media",
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const goldenDatasetPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "contracts",
  "golden-dataset",
  "mei-xiang-family.v1.json",
);

function issue(code, pathValue, message) {
  return { code, path: pathValue, message };
}

function validateRecordEnvelope(record, collection, index, errors) {
  if (!record || typeof record !== "object") {
    errors.push(issue("invalid_record", `${collection}[${index}]`, "Record must be an object."));
    return;
  }
  if (typeof record.id !== "string" || record.id.length === 0) {
    errors.push(issue("missing_id", `${collection}[${index}].id`, "Record id is required."));
  }
  if (!record.public || typeof record.public !== "object") {
    errors.push(
      issue("missing_public_fields", `${collection}[${index}].public`, "Public fields are required."),
    );
  }
  if (!record.restricted || typeof record.restricted !== "object") {
    errors.push(
      issue(
        "missing_restricted_fields",
        `${collection}[${index}].restricted`,
        "Restricted fields are required, even when empty.",
      ),
    );
  }
  if (!new Set(["published", "draft", "restricted"]).has(record.publication_status)) {
    errors.push(
      issue(
        "invalid_publication_status",
        `${collection}[${index}].publication_status`,
        "publication_status must be published, draft, or restricted.",
      ),
    );
  }
}

function collectSourceReferences(value, pathValue = "public", references = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSourceReferences(item, `${pathValue}[${index}]`, references));
    return references;
  }
  if (!value || typeof value !== "object") {
    return references;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${pathValue}.${key}`;
    if (key === "source_ids" && Array.isArray(child)) {
      child.forEach((id, index) => references.push({ id, path: `${childPath}[${index}]` }));
      continue;
    }
    collectSourceReferences(child, childPath, references);
  }
  return references;
}

function projectRecord(record) {
  return {
    id: record.id,
    ...structuredClone(record.public),
  };
}

function recordMap(records) {
  return new Map((records ?? []).map((record) => [record.id, record]));
}

function addReferenceError(errors, pathValue, type, id) {
  errors.push(issue("invalid_reference", pathValue, `Unknown ${type} reference: ${id}`));
}

function assertReference({ errors, pathValue, type, id, records, owner }) {
  const dependency = records.get(id);
  if (!dependency) {
    addReferenceError(errors, pathValue, type, id);
    return;
  }
  if (owner.publication_status === "published" && dependency.publication_status !== "published") {
    errors.push(
      issue(
        "unpublished_dependency",
        pathValue,
        `Published record ${owner.id} depends on unpublished ${type} ${id}.`,
      ),
    );
  }
}

function parseIntervalDate(value, pathValue, errors, { openEnded = false } = {}) {
  if (value === null && openEnded) {
    return Number.POSITIVE_INFINITY;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    errors.push(issue("invalid_date", pathValue, `Invalid ISO date: ${String(value)}`));
    return null;
  }
  return timestamp;
}

function validateReferences(dataset, errors) {
  const sources = recordMap(dataset.sources);
  const facilities = recordMap(dataset.facilities);
  const pandas = recordMap([...(dataset.pandas ?? []), ...(dataset.related_pandas ?? [])]);

  for (const collection of RECORD_COLLECTIONS) {
    for (const [index, record] of (dataset[collection] ?? []).entries()) {
      for (const reference of collectSourceReferences(record.public)) {
        const source = sources.get(reference.id);
        const pathValue = `${collection}[${index}].${reference.path}`;
        if (!source) {
          errors.push(issue("missing_source", pathValue, `Unknown source reference: ${reference.id}`));
        } else if (
          record.publication_status === "published" &&
          source.publication_status !== "published"
        ) {
          errors.push(
            issue(
              "unpublished_dependency",
              pathValue,
              `Published record ${record.id} depends on unpublished source ${reference.id}.`,
            ),
          );
        }
      }
    }
  }

  for (const [index, record] of (dataset.facts ?? []).entries()) {
    if (!record.public || typeof record.public !== "object") continue;
    assertReference({
      errors,
      pathValue: `facts[${index}].public.subject_id`,
      type: "panda",
      id: record.public.subject_id,
      records: pandas,
      owner: record,
    });
    if (record.public.field === "current_facility_id") {
      assertReference({
        errors,
        pathValue: `facts[${index}].public.value`,
        type: "facility",
        id: record.public.value,
        records: facilities,
        owner: record,
      });
    }
  }

  for (const [index, record] of (dataset.parentage_assertions ?? []).entries()) {
    if (!record.public || typeof record.public !== "object") continue;
    for (const field of ["child_id", "parent_id"]) {
      assertReference({
        errors,
        pathValue: `parentage_assertions[${index}].public.${field}`,
        type: "panda",
        id: record.public[field],
        records: pandas,
        owner: record,
      });
    }
  }

  for (const [index, record] of (dataset.residencies ?? []).entries()) {
    if (!record.public || typeof record.public !== "object") continue;
    assertReference({
      errors,
      pathValue: `residencies[${index}].public.panda_id`,
      type: "panda",
      id: record.public.panda_id,
      records: pandas,
      owner: record,
    });
    assertReference({
      errors,
      pathValue: `residencies[${index}].public.facility_id`,
      type: "facility",
      id: record.public.facility_id,
      records: facilities,
      owner: record,
    });
  }

  for (const [index, record] of (dataset.events ?? []).entries()) {
    if (!record.public || typeof record.public !== "object") continue;
    for (const [participantIndex, pandaId] of (record.public.participants ?? []).entries()) {
      assertReference({
        errors,
        pathValue: `events[${index}].public.participants[${participantIndex}]`,
        type: "panda",
        id: pandaId,
        records: pandas,
        owner: record,
      });
    }
    for (const field of ["from_facility_id", "to_facility_id"]) {
      if (record.public[field] === null || record.public[field] === undefined) continue;
      assertReference({
        errors,
        pathValue: `events[${index}].public.${field}`,
        type: "facility",
        id: record.public[field],
        records: facilities,
        owner: record,
      });
    }
  }

  for (const [index, record] of (dataset.media ?? []).entries()) {
    if (!record.public || typeof record.public !== "object") continue;
    assertReference({
      errors,
      pathValue: `media[${index}].public.panda_id`,
      type: "panda",
      id: record.public.panda_id,
      records: pandas,
      owner: record,
    });
  }
}

function validateResidencyIntervals(dataset, errors) {
  const groups = new Map();
  for (const [index, record] of (dataset.residencies ?? []).entries()) {
    if (record.public?.residency_type !== "primary") continue;
    const start = parseIntervalDate(
      record.public.start_date,
      `residencies[${index}].public.start_date`,
      errors,
    );
    const end = parseIntervalDate(
      record.public.end_date,
      `residencies[${index}].public.end_date`,
      errors,
      { openEnded: true },
    );
    if (start === null || end === null) continue;
    if (start >= end) {
      errors.push(
        issue(
          "invalid_residency_interval",
          `residencies[${index}].public`,
          `Residency ${record.id} must end after it starts.`,
        ),
      );
      continue;
    }
    const entries = groups.get(record.public.panda_id) ?? [];
    entries.push({ record, index, start, end });
    groups.set(record.public.panda_id, entries);
  }

  for (const entries of groups.values()) {
    entries.sort((left, right) => left.start - right.start);
    for (let index = 1; index < entries.length; index += 1) {
      const previous = entries[index - 1];
      const current = entries[index];
      if (current.start < previous.end) {
        errors.push(
          issue(
            "overlapping_residency",
            `residencies[${current.index}].public`,
            `Primary residencies ${previous.record.id} and ${current.record.id} overlap.`,
          ),
        );
      }
    }
  }
}

export async function loadGoldenDataset({ consumer } = {}) {
  if (consumer !== undefined && !GOLDEN_DATASET_CONSUMERS.includes(consumer)) {
    throw new Error(`Unsupported golden dataset consumer: ${consumer}`);
  }
  const dataset = JSON.parse(await readFile(goldenDatasetPath, "utf8"));
  return structuredClone(dataset);
}

export function buildPublicProjection(dataset) {
  const projection = {
    dataset: {
      id: dataset.dataset.id,
      version: dataset.dataset.version,
      public_schema_version: dataset.dataset.public_schema_version,
      licenses: structuredClone(dataset.dataset.licenses),
    },
  };

  for (const collection of RECORD_COLLECTIONS) {
    projection[collection] = (dataset[collection] ?? [])
      .filter((record) => record.publication_status === "published")
      .map(projectRecord);
  }

  return projection;
}

export function validateGoldenDataset(dataset) {
  const errors = [];
  const warnings = [];

  if (dataset?.contract_version !== "1.0.0") {
    errors.push(
      issue(
        "unsupported_contract_version",
        "contract_version",
        "Golden dataset contract_version must be 1.0.0.",
      ),
    );
  }

  if (!dataset?.dataset || dataset.dataset.id !== "mei-xiang-family") {
    errors.push(issue("invalid_dataset_identity", "dataset.id", "Dataset id must be mei-xiang-family."));
  } else {
    if (dataset.dataset.core_panda_count !== 7) {
      errors.push(
        issue("invalid_core_count", "dataset.core_panda_count", "core_panda_count must equal seven."),
      );
    }
    if (
      JSON.stringify(dataset.dataset.fixture_consumers) !==
      JSON.stringify(GOLDEN_DATASET_CONSUMERS)
    ) {
      errors.push(
        issue(
          "invalid_fixture_consumers",
          "dataset.fixture_consumers",
          `fixture_consumers must be ${GOLDEN_DATASET_CONSUMERS.join(", ")}.`,
        ),
      );
    }
  }

  const allIds = new Map();
  for (const collection of RECORD_COLLECTIONS) {
    if (!Array.isArray(dataset?.[collection])) {
      errors.push(issue("missing_collection", collection, `${collection} collection is required.`));
      continue;
    }
    dataset[collection].forEach((record, index) => {
      validateRecordEnvelope(record, collection, index, errors);
      if (typeof record?.id !== "string") return;
      if (allIds.has(record.id)) {
        errors.push(
          issue(
            "duplicate_id",
            `${collection}[${index}].id`,
            `Duplicate id ${record.id}; first used at ${allIds.get(record.id)}.`,
          ),
        );
      } else {
        allIds.set(record.id, `${collection}[${index}]`);
      }
    });
  }

  if (Array.isArray(dataset?.pandas)) {
    const slugs = dataset.pandas.map((record) => record.public?.canonical_slug);
    if (dataset.pandas.length !== 7) {
      errors.push(issue("invalid_core_count", "pandas", "Golden dataset must define exactly seven core pandas."));
    }
    if (JSON.stringify(slugs) !== JSON.stringify(CORE_PANDA_SLUGS)) {
      errors.push(
        issue(
          "invalid_core_identity_order",
          "pandas",
          `Core panda slugs must be: ${CORE_PANDA_SLUGS.join(", ")}.`,
        ),
      );
    }

    for (const slug of ["mei-xiang", "tian-tian"]) {
      const record = dataset.pandas.find((candidate) => candidate.public?.canonical_slug === slug);
      const basePath = `pandas.${slug}`;
      if (!record) {
        errors.push(issue("missing_anchor_record", basePath, `Missing anchor record ${slug}.`));
        continue;
      }
      if (record.public.record_tier !== "complete_first_pass") {
        errors.push(
          issue(
            "incomplete_anchor_record",
            `${basePath}.public.record_tier`,
            `${slug} must be complete_first_pass.`,
          ),
        );
      }
      for (const [field, minimum] of [
        ["names", 3],
        ["aliases", 1],
        ["external_identifiers", 1],
        ["legacy_slugs", 1],
      ]) {
        if (!Array.isArray(record.public[field]) || record.public[field].length < minimum) {
          errors.push(
            issue(
              "incomplete_anchor_record",
              `${basePath}.public.${field}`,
              `${slug} requires at least ${minimum} ${field}.`,
            ),
          );
        }
      }
    }
  }

  validateReferences(dataset, errors);
  validateResidencyIntervals(dataset, errors);

  return { valid: errors.length === 0, errors, warnings };
}
