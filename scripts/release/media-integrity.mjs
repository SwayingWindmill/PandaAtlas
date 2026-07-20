import { isDeepStrictEqual } from "node:util";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const MEDIA_ID_PATTERN = /^media-[a-z0-9-]+-[a-f0-9]{16}$/;
const UNKNOWN_RIGHTS = new Set(["", "unknown", "unclear", "copyright_unknown", "none"]);
const REQUIRED_DERIVATIVE_KINDS = new Map([
  ["width-480", 480],
  ["width-1200", 1200],
]);
const IMAGE_PAYLOAD_FIELDS = [
  "url",
  "derivatives",
  "mime_type",
  "width",
  "height",
  "bytes",
  "sha256",
];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireString(record, field, label) {
  requireCondition(nonEmptyString(record?.[field]), `${label} requires ${field}`);
  return record[field].trim();
}

function requirePositiveInteger(value, field, label) {
  requireCondition(
    Number.isInteger(value) && value > 0,
    `${label} requires positive integer ${field}; got ${String(value)}`,
  );
}

function assertReviewedSource(source, allowedStates, label) {
  requireCondition(source, `${label} references a missing source`);
  requireCondition(source.publication_status === "published", `${label} source ${source.id} is not published`);
  requireCondition(
    allowedStates.has(source.public.access_state),
    `${label} source ${source.id} is not reviewed and accessible`,
  );
  requireCondition(
    /^\d{4}-\d{2}-\d{2}$/.test(source.public.last_verified_at),
    `${label} source ${source.id} has no verification date`,
  );
}

function assertSourceReferences(publicValue, sources, allowedStates, label) {
  requireCondition(
    Array.isArray(publicValue.source_ids) && publicValue.source_ids.length > 0,
    `${label} requires source_ids`,
  );
  const uniqueSourceIds = new Set(publicValue.source_ids);
  requireCondition(
    uniqueSourceIds.size === publicValue.source_ids.length,
    `${label} has duplicate source_ids`,
  );
  for (const sourceId of publicValue.source_ids) {
    assertReviewedSource(sources.get(sourceId), allowedStates, label);
  }
}

function assertRetainedHumanMetadata(publicValue, sources, allowedStates, label) {
  const rights = requireString(publicValue, "rights", label).toLowerCase();
  requireCondition(!UNKNOWN_RIGHTS.has(rights), `${label} rights are unknown or unclear`);
  requireString(publicValue, "credit", label);
  requireString(publicValue, "alt_zh", label);
  requireString(publicValue, "alt_en", label);
  const sourceUrl = requireString(publicValue, "source_url", label);
  requireCondition(sourceUrl.startsWith("https://"), `${label} source_url must use HTTPS`);
  assertSourceReferences(publicValue, sources, allowedStates, label);
}

function expectedDerivativeUrl(releaseVersion, mediaId, width) {
  return `https://api.zhipanda.com/media/releases/${releaseVersion}/${mediaId}-w${width}.webp`;
}

function mediaReleaseVersion(publicValue, dataset, mediaId, label, allowedReleaseVersions) {
  const match = String(publicValue.url ?? "").match(
    new RegExp(
      `^https://api\\.zhipanda\\.com/media/releases/(\\d{4}\\.\\d{2}\\.\\d{2}\\.\\d+)/${mediaId}-w1200\\.webp$`,
    ),
  );
  requireCondition(match, `${label} url is not an immutable release media URL`);
  const allowedVersions = allowedReleaseVersions ?? new Set(
    [dataset.dataset.version, dataset.dataset.base_dataset_version].filter(
      (value) => typeof value === "string",
    ),
  );
  requireCondition(
    allowedVersions.has(match[1]),
    `${label} url release ${match[1]} is not a tracked reviewed Public Release`,
  );
  return match[1];
}

function assertNoImagePayload(publicValue, label) {
  for (const field of IMAGE_PAYLOAD_FIELDS) {
    const value = publicValue[field];
    const absent =
      value == null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    requireCondition(absent, `${label} cannot expose ${field}`);
  }
}

function assertDerivative(derivative, releaseVersion, mediaId, label) {
  const kind = requireString(derivative, "kind", label);
  const expectedWidth = REQUIRED_DERIVATIVE_KINDS.get(kind);
  requireCondition(expectedWidth, `${label} has unsupported derivative kind ${kind}`);
  requirePositiveInteger(derivative.width, "width", label);
  requirePositiveInteger(derivative.height, "height", label);
  requirePositiveInteger(derivative.bytes, "bytes", label);
  requireCondition(
    derivative.width === expectedWidth,
    `${label} ${kind} width drifted: expected ${expectedWidth}; got ${String(derivative.width)}`,
  );
  requireCondition(derivative.mime_type === "image/webp", `${label} ${kind} mime_type must be image/webp`);
  requireCondition(
    SHA256_PATTERN.test(derivative.sha256 ?? ""),
    `${label} ${kind} sha256 must be a 64-character hexadecimal digest`,
  );
  const expectedUrl = expectedDerivativeUrl(releaseVersion, mediaId, expectedWidth);
  requireCondition(
    derivative.url === expectedUrl,
    `${label} ${kind} url drifted: expected ${expectedUrl}; got ${String(derivative.url)}`,
  );
}

function assertAvailableMedia(
  media,
  dataset,
  sources,
  allowedStates,
  globalUrls,
  label,
  allowedReleaseVersions,
) {
  const publicValue = media.public;
  requireCondition(MEDIA_ID_PATTERN.test(media.id), `${label} media ID is not system-generated`);
  assertRetainedHumanMetadata(publicValue, sources, allowedStates, label);
  requirePositiveInteger(publicValue.width, "width", label);
  requirePositiveInteger(publicValue.height, "height", label);
  requirePositiveInteger(publicValue.bytes, "bytes", label);
  requireCondition(publicValue.mime_type === "image/webp", `${label} mime_type must be image/webp`);
  requireCondition(
    SHA256_PATTERN.test(publicValue.sha256 ?? ""),
    `${label} sha256 must be a 64-character hexadecimal digest`,
  );
  const immutableReleaseVersion = mediaReleaseVersion(
    publicValue,
    dataset,
    media.id,
    label,
    allowedReleaseVersions,
  );
  requireCondition(Array.isArray(publicValue.derivatives), `${label} requires derivatives`);
  requireCondition(
    publicValue.derivatives.length >= REQUIRED_DERIVATIVE_KINDS.size,
    `${label} requires WebP derivatives`,
  );

  const derivativeKinds = new Set();
  const derivativeUrls = new Set();
  for (const derivative of publicValue.derivatives) {
    const derivativeLabel = `${label} derivative ${derivative?.kind ?? "unknown"}`;
    assertDerivative(derivative, immutableReleaseVersion, media.id, derivativeLabel);
    requireCondition(
      !derivativeKinds.has(derivative.kind),
      `${label} has duplicate derivative kind ${derivative.kind}`,
    );
    requireCondition(
      !derivativeUrls.has(derivative.url),
      `${label} has duplicate derivative url ${derivative.url}`,
    );
    requireCondition(
      !globalUrls.has(derivative.url),
      `${label} derivative url ${derivative.url} is reused by another media record`,
    );
    derivativeKinds.add(derivative.kind);
    derivativeUrls.add(derivative.url);
    globalUrls.add(derivative.url);
  }
  for (const kind of REQUIRED_DERIVATIVE_KINDS.keys()) {
    requireCondition(derivativeKinds.has(kind), `${label} is missing required derivative ${kind}`);
  }

  const primary = publicValue.derivatives.find((item) => item.kind === "width-1200");
  requireCondition(publicValue.url === primary.url, `${label} primary url must equal width-1200 derivative url`);
  requireCondition(publicValue.width === primary.width, `${label} primary width must equal width-1200 derivative width`);
  requireCondition(publicValue.height === primary.height, `${label} primary height must equal width-1200 derivative height`);
  requireCondition(publicValue.bytes === primary.bytes, `${label} primary bytes must equal width-1200 derivative bytes`);
  requireCondition(
    publicValue.mime_type === primary.mime_type,
    `${label} primary mime_type must equal width-1200 derivative mime_type`,
  );
  requireCondition(publicValue.sha256 === primary.sha256, `${label} primary sha256 must equal width-1200 derivative sha256`);
}

function assertLegacyMedia(publicValue, sources, allowedStates, label) {
  assertNoImagePayload(publicValue, label);
  requireCondition(Array.isArray(publicValue.source_ids), `${label} requires source_ids array`);
  if (publicValue.display_mode === "designed_empty_state") {
    requireCondition(
      publicValue.license_state === "no_licensed_media",
      `${label} designed_empty_state requires no_licensed_media`,
    );
    requireCondition(
      publicValue.source_ids.length === 0,
      `${label} no_licensed_media cannot reference media sources`,
    );
    return;
  }
  requireCondition(publicValue.display_mode === "link_to_source", `${label} has invalid display_mode`);
  requireCondition(
    publicValue.license_state === "source_link_only",
    `${label} link_to_source requires source_link_only`,
  );
  assertSourceReferences(publicValue, sources, allowedStates, label);
}

function assertProjection(api, publishedPandas, publishedMediaByPanda, labelByPanda) {
  requireCondition(api && Array.isArray(api.pandas), "api.json must contain pandas for media projection validation");
  const profiles = new Map();
  for (const profile of api.pandas) {
    requireCondition(!profiles.has(profile.id), `api.json contains duplicate panda profile ${profile.id}`);
    profiles.set(profile.id, profile);
  }

  for (const [pandaId] of publishedPandas) {
    const pandaLabel = labelByPanda.get(pandaId) ?? pandaId;
    const profile = profiles.get(pandaId);
    requireCondition(profile, `${pandaLabel} is missing from api.json media projection`);
    const allMedia = publishedMediaByPanda.get(pandaId) ?? [];
    const expectedMedia = allMedia.filter((media) => media.public.status === "available");
    const projectedMedia = profile.media ?? [];
    requireCondition(Array.isArray(projectedMedia), `${pandaLabel} api.json media must be an array`);
    const projectedIds = projectedMedia.map((item) => item.id);
    requireCondition(
      new Set(projectedIds).size === projectedIds.length,
      `${pandaLabel} api.json contains duplicate media IDs`,
    );
    const expectedIds = expectedMedia.map((item) => item.id).sort();
    requireCondition(
      JSON.stringify([...projectedIds].sort()) === JSON.stringify(expectedIds),
      `${pandaLabel} api.json available media set drifted: expected ${expectedIds.join(", ") || "none"}; got ${projectedIds.join(", ") || "none"}`,
    );

    for (const sourceMedia of expectedMedia) {
      const projected = projectedMedia.find((item) => item.id === sourceMedia.id);
      const expectedKeys = [...Object.keys(sourceMedia.public), "id"].sort();
      const projectedKeys = Object.keys(projected).sort();
      requireCondition(
        JSON.stringify(projectedKeys) === JSON.stringify(expectedKeys),
        `${pandaLabel} media ${sourceMedia.id} api.json fields drifted`,
      );
      for (const [field, expected] of Object.entries(sourceMedia.public)) {
        requireCondition(
          isDeepStrictEqual(projected[field], expected),
          `${pandaLabel} media ${sourceMedia.id} api.json ${field} drifted`,
        );
      }
    }

    if (expectedMedia.length > 0) {
      const coverMatches = expectedMedia.filter(
        (media) => media.public.url === profile.cover_image_url,
      );
      requireCondition(
        coverMatches.length === 1,
        `${pandaLabel} cover_image_url must select exactly one available reviewed media record`,
      );
      requireCondition(
        profile.media_release?.display_mode === "gallery",
        `${pandaLabel} media_release must use gallery`,
      );
      requireCondition(
        profile.media_release?.license_state === "licensed",
        `${pandaLabel} media_release must be licensed`,
      );
      const expectedSourceIds = [
        ...new Set(expectedMedia.flatMap((media) => media.public.source_ids)),
      ].sort();
      const projectedSourceIds = [...(profile.media_release?.source_ids ?? [])].sort();
      requireCondition(
        JSON.stringify(projectedSourceIds) === JSON.stringify(expectedSourceIds),
        `${pandaLabel} media_release source_ids drifted`,
      );
    } else {
      requireCondition(
        profile.cover_image_url == null,
        `${pandaLabel} cannot expose cover_image_url without available media`,
      );
      const legacy = allMedia.filter((media) => media.public.status == null);
      if (legacy.length === 1) {
        requireCondition(
          profile.media_release?.display_mode === legacy[0].public.display_mode,
          `${pandaLabel} media_release display_mode drifted`,
        );
        requireCondition(
          profile.media_release?.license_state === legacy[0].public.license_state,
          `${pandaLabel} media_release license_state drifted`,
        );
      }
    }
  }
}

export function assertReviewedMediaArchive(
  dataset,
  contract,
  api = null,
  allowedReleaseVersions = null,
) {
  requireCondition(Array.isArray(dataset?.media), "trusted archive is missing media");
  requireCondition(Array.isArray(dataset?.pandas), "trusted archive is missing pandas");
  requireCondition(Array.isArray(dataset?.sources), "trusted archive is missing sources");
  requireCondition(
    /^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(dataset?.dataset?.version ?? ""),
    "media archive requires a versioned dataset",
  );

  const publishedPandas = new Map(
    dataset.pandas
      .filter((item) => item.publication_status === "published")
      .map((item) => [item.id, item]),
  );
  const labelByPanda = new Map(
    [...publishedPandas].map(([id, panda]) => [id, panda.public?.canonical_slug ?? id]),
  );
  const sources = new Map(dataset.sources.map((source) => [source.id, source]));
  const allowedStates = new Set(contract.allowed_reviewed_source_states);
  const mediaIds = new Set();
  const globalUrls = new Set();
  const publishedMediaByPanda = new Map();

  for (const media of dataset.media) {
    requireCondition(nonEmptyString(media?.id), "media record requires id");
    requireCondition(!mediaIds.has(media.id), `duplicate media ID ${media.id}`);
    mediaIds.add(media.id);
    if (media.publication_status !== "published") continue;

    const pandaId = media.public?.panda_id;
    const panda = publishedPandas.get(pandaId);
    const pandaLabel = labelByPanda.get(pandaId) ?? pandaId ?? "missing-panda";
    const label = `${pandaLabel} media ${media.id}`;
    requireCondition(
      panda,
      `${label} references unpublished or missing panda ${String(pandaId)}`,
    );
    const pandaMedia = publishedMediaByPanda.get(pandaId) ?? [];
    pandaMedia.push(media);
    publishedMediaByPanda.set(pandaId, pandaMedia);

    const status = media.public.status;
    if (status != null) {
      requireCondition(MEDIA_ID_PATTERN.test(media.id), `${label} media ID is not system-generated`);
    }
    if (status === "available") {
      assertAvailableMedia(
        media,
        dataset,
        sources,
        allowedStates,
        globalUrls,
        label,
        allowedReleaseVersions,
      );
      continue;
    }
    if (status === "withdrawn" || status === "unavailable") {
      assertRetainedHumanMetadata(media.public, sources, allowedStates, label);
      assertNoImagePayload(media.public, label);
      continue;
    }
    if (status == null) {
      assertLegacyMedia(media.public, sources, allowedStates, label);
      continue;
    }
    throw new Error(`${label} has invalid status ${String(status)}`);
  }

  for (const pandaId of dataset.dataset.expansion_panda_ids ?? []) {
    const pandaLabel = labelByPanda.get(pandaId) ?? pandaId;
    const availableCount = (publishedMediaByPanda.get(pandaId) ?? []).filter(
      (media) => media.public.status === "available",
    ).length;
    requireCondition(
      availableCount >= 1,
      `${pandaLabel} requires at least one available reviewed photo; found ${availableCount}`,
    );
  }

  if (api) assertProjection(api, publishedPandas, publishedMediaByPanda, labelByPanda);

  const published = [...publishedMediaByPanda.values()].flat();
  return {
    published_media: published.length,
    available_media: published.filter((media) => media.public.status === "available").length,
  };
}
