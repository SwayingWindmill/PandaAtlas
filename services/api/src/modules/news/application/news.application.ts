import type { PublicVenueNewsItem, VenueNewsKind } from "../../catalog/application/venue-news-catalog.js";
import type { PublicReadPort } from "../../public-read/application/public-read.application.js";
import { DomainError } from "../../../platform/errors/domain-error.js";
import { createNewsEntityResolver, type EntityReferenceCatalog } from "./news-entity-resolution.js";
import { evaluateFactCandidate, type ExtractedFactChangeInput, type FactGateEvaluation } from "./news-fact-gate.js";

export const NEWS_PLATFORMS = [
  "weibo",
  "douyin",
  "xiaohongshu",
  "douban",
  "bilibili",
  "web",
  "x",
  "wechat",
] as const;
export type NewsPlatform = (typeof NEWS_PLATFORMS)[number];

export const NEWS_SOURCE_TIERS = ["institution", "official", "media", "fan"] as const;
export type NewsSourceTier = (typeof NEWS_SOURCE_TIERS)[number];

export const NEWS_KINDS = [
  "enclosure",
  "schedule",
  "closure",
  "arrival",
  "departure",
  "event",
  "birth",
  "death",
  "transfer",
  "naming",
  "other",
] as const;
export type NewsKind = (typeof NEWS_KINDS)[number];

export const NEWS_ITEM_STATUSES = ["pending_review", "published", "rejected", "hidden"] as const;
export type NewsItemStatus = (typeof NEWS_ITEM_STATUSES)[number];

export const NEWS_REVIEW_DECISIONS = ["publish", "reject", "hide"] as const;
export type NewsReviewDecision = (typeof NEWS_REVIEW_DECISIONS)[number];

export const FACT_REVIEW_STATES = ["pending_review", "approved", "rejected"] as const;
export type FactReviewState = (typeof FACT_REVIEW_STATES)[number];

export interface NewsIngestItemInput {
  externalId: string;
  platform: NewsPlatform;
  sourceTier: NewsSourceTier;
  authorInstitutionSlug?: string;
  sourceUrl: string;
  sourcePublisher: string;
  publishedAt: string;
  kind: NewsKind;
  scope: "single" | "composite" | "unknown";
  titleZh: string;
  summaryZh: string;
  pandaNames: string[];
  institutionName?: string;
  coverUrl?: string;
  factChange?: ExtractedFactChangeInput;
  evidenceQuote?: string;
}

export interface PublicNewsItem {
  newsItemId: string;
  platform: NewsPlatform;
  sourceTier: NewsSourceTier;
  kind: NewsKind;
  titleZh: string;
  summaryZh: string;
  sourceUrl: string;
  sourcePublisher: string;
  coverUrl?: string;
  pandaIds: string[];
  pandaSlugs: string[];
  institutionId?: string;
  institutionSlug?: string;
  institutionName?: string;
  publishedAt: string;
}

export interface PublicNewsPage {
  items: PublicNewsItem[];
  nextCursor?: string;
}

export interface NewsReviewItem extends PublicNewsItem {
  externalId: string;
  rawPandaNames: string[];
  status: NewsItemStatus;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface FactCandidateEvidence {
  newsItemId: string;
  sourceUrl: string;
  sourceTier: string;
  sourcePublisher: string;
  quote: string;
  publishedAt: string;
}

export interface FactCandidateRecord {
  candidateId: string;
  candidateKey: string;
  newsItemId: string;
  kind: string;
  phase?: string;
  namingStatus?: string;
  eventDate?: string;
  targetPandaId?: string;
  targetPandaSlug?: string;
  rawPandaNames: string[];
  targetInstitutionId?: string;
  targetInstitutionSlug?: string;
  rawInstitutionName?: string;
  changePayload: Record<string, unknown>;
  evidenceItems: FactCandidateEvidence[];
  gateStatus: string;
  reviewState: FactReviewState;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface NewsIngestPersistenceInput {
  externalId: string;
  platform: NewsPlatform;
  sourceTier: NewsSourceTier;
  sourceUrl: string;
  sourcePublisher: string;
  titleZh: string;
  summaryZh: string;
  kind: NewsKind;
  coverUrl?: string;
  pandaIds: string[];
  pandaSlugs: string[];
  primaryPandaName?: string;
  rawPandaNames: string[];
  institutionId?: string;
  institutionSlug?: string;
  institutionName?: string;
  publishedAt: Date;
  initialStatus: "pending_review" | "published";
  factCandidate?: FactGateEvaluation & {
    rawInstitutionName?: string;
    changePayload: Record<string, unknown>;
    evidence: FactCandidateEvidence;
  };
}

export interface NewsRepository {
  upsertIngestedBatch(
    items: readonly NewsIngestPersistenceInput[],
    correlationId: string,
  ): Promise<{ accepted: number; published: number; pendingReview: number; factCandidatesCreated: number }>;
  listPublicNews(query: {
    pandaSlug?: string;
    institutionSlug?: string;
    sourceTier?: NewsSourceTier;
    limit: number;
    cursor?: { publishedAt: string; newsItemId: string };
  }): Promise<PublicNewsItem[]>;
  listPublishedOfficialVenueNews(institutionSlug?: string, limit?: number): Promise<PublicVenueNewsItem[]>;
  listReviewItems(query: { status?: NewsItemStatus; limit: number; offset: number }): Promise<NewsReviewItem[]>;
  decideReviewItem(input: {
    newsItemId: string;
    actorAccountId: string;
    decision: NewsReviewDecision;
    reviewNote?: string;
    pandaIds?: string[];
    pandaSlugs?: string[];
    primaryPandaName?: string;
    institutionId?: string;
    institutionSlug?: string;
    institutionName?: string;
    correlationId: string;
  }): Promise<NewsReviewItem | undefined>;
  listFactCandidates(query: { reviewState?: FactReviewState; limit: number; offset: number }): Promise<FactCandidateRecord[]>;
  decideFactCandidate(input: {
    candidateId: string;
    actorAccountId: string;
    reviewState: "approved" | "rejected";
    reviewNote?: string;
    targetPandaId?: string;
    targetPandaSlug?: string;
    targetInstitutionId?: string;
    targetInstitutionSlug?: string;
    correlationId: string;
  }): Promise<FactCandidateRecord | undefined>;
}

const VENUE_NEWS_KIND_SET = new Set<string>([
  "enclosure",
  "schedule",
  "closure",
  "arrival",
  "departure",
  "event",
  "other",
]);

export function mapNewsKindToVenueKind(kind: NewsKind): VenueNewsKind {
  return VENUE_NEWS_KIND_SET.has(kind) ? (kind as VenueNewsKind) : "event";
}

function assertHttpsUrl(raw: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DomainError("invalid", "news.invalidUrl", `${field} must be a valid URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new DomainError("invalid", "news.httpsRequired", `${field} must use https.`);
  }
  return parsed.toString();
}

export function encodeNewsCursor(publishedAt: string, newsItemId: string): string {
  return Buffer.from(JSON.stringify({ p: publishedAt, id: newsItemId }), "utf8").toString("base64url");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decodeNewsCursor(raw: string): { publishedAt: string; newsItemId: string } {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { p?: unknown; id?: unknown };
    if (
      typeof parsed.p !== "string" ||
      typeof parsed.id !== "string" ||
      !UUID_PATTERN.test(parsed.id) ||
      Number.isNaN(Date.parse(parsed.p))
    ) {
      throw new Error("invalid");
    }
    return { publishedAt: parsed.p, newsItemId: parsed.id };
  } catch {
    throw new DomainError("invalid", "news.invalidCursor", "cursor is malformed.");
  }
}

export const NEWS_PORT = Symbol("NEWS_PORT");

export interface NewsPort {
  ingestBatch(
    items: readonly NewsIngestItemInput[],
    correlationId: string,
  ): Promise<{ accepted: number; published: number; pendingReview: number; factCandidatesCreated: number }>;
  listPublicNews(query: {
    panda?: string;
    institution?: string;
    sourceTier?: NewsSourceTier;
    limit?: number;
    cursor?: string;
  }): Promise<PublicNewsPage>;
  listPublishedOfficialVenueNews(institutionSlug?: string): Promise<PublicVenueNewsItem[]>;
  listReviewItems(query: { status?: NewsItemStatus; limit?: number; offset?: number }): Promise<NewsReviewItem[]>;
  decideReviewItem(input: {
    newsItemId: string;
    actorAccountId: string;
    decision: NewsReviewDecision;
    reviewNote?: string;
    pandaSlugs?: string[];
    institutionSlug?: string;
    correlationId: string;
  }): Promise<NewsReviewItem>;
  listFactCandidates(query: { reviewState?: FactReviewState; limit?: number; offset?: number }): Promise<FactCandidateRecord[]>;
  decideFactCandidate(input: {
    candidateId: string;
    actorAccountId: string;
    decision: "approved" | "rejected";
    reviewNote?: string;
    targetPandaSlug?: string;
    targetInstitutionSlug?: string;
    correlationId: string;
  }): Promise<FactCandidateRecord>;
}

export class NewsApplication implements NewsPort {
  public constructor(
    private readonly repository: NewsRepository,
    private readonly publicRead: PublicReadPort,
    private readonly autoPublishTiers: ReadonlySet<NewsSourceTier>,
  ) {}

  private async loadCatalog(): Promise<EntityReferenceCatalog> {
    const [pandasRes, instRes, placesRes, residenciesRes] = await Promise.all([
      this.publicRead.listPandas(),
      this.publicRead.listInstitutions(),
      this.publicRead.listPlaces(),
      this.publicRead.listResidencies(),
    ]);
    return {
      pandas: pandasRes.kind === "ok" ? pandasRes.value.items : [],
      institutions: instRes.kind === "ok" ? instRes.value.items : [],
      places: placesRes.kind === "ok" ? placesRes.value.items : [],
      residencies: residenciesRes.kind === "ok" ? residenciesRes.value.items : [],
    };
  }

  public async ingestBatch(
    items: readonly NewsIngestItemInput[],
    correlationId: string,
  ): Promise<{ accepted: number; published: number; pendingReview: number; factCandidatesCreated: number }> {
    const catalog = await this.loadCatalog();
    const resolver = createNewsEntityResolver(catalog);
    const prepared: NewsIngestPersistenceInput[] = [];

    for (const item of items) {
      const sourceUrl = assertHttpsUrl(item.sourceUrl, "sourceUrl");
      // Strictly strip non-T1 images; never mirror social bloggers' photos.
      const coverUrl =
        item.sourceTier === "institution" && item.coverUrl ? assertHttpsUrl(item.coverUrl, "coverUrl") : undefined;
      const publishedDate = new Date(item.publishedAt);
      if (Number.isNaN(publishedDate.getTime())) {
        throw new DomainError("invalid", "news.invalidPublishedAt", "publishedAt must be an ISO timestamp.");
      }

      const resolution = resolver.resolveItem({
        sourceTier: item.sourceTier,
        sourceUrl,
        authorInstitutionSlug: item.authorInstitutionSlug,
        institutionName: item.institutionName,
        toPlaceName: item.factChange?.toPlace ?? undefined,
        pandaNames: item.pandaNames,
      });

      const factEvaluation = evaluateFactCandidate({
        sourceTier: item.sourceTier,
        publishedAtIso: publishedDate.toISOString(),
        scope: item.scope,
        factChange: item.factChange,
        evidenceQuote: item.evidenceQuote,
        resolution,
        allPandas: catalog.pandas,
        allResidencies: catalog.residencies,
        rawPandaNames: item.pandaNames,
      });

      prepared.push({
        externalId: item.externalId.trim(),
        platform: item.platform,
        sourceTier: item.sourceTier,
        sourceUrl,
        sourcePublisher: item.sourcePublisher.trim(),
        titleZh: item.titleZh.trim(),
        summaryZh: item.summaryZh.trim(),
        kind: item.kind,
        coverUrl,
        pandaIds: resolution.pandas.map((panda) => panda.pandaId),
        pandaSlugs: resolution.pandas.map((panda) => panda.canonicalSlug),
        primaryPandaName: resolution.pandas[0]?.name,
        rawPandaNames: item.pandaNames.map((name) => name.trim()).filter(Boolean),
        institutionId: resolution.institution?.institutionId,
        institutionSlug: resolution.institution?.slug,
        institutionName: resolution.institution?.name ?? item.institutionName?.trim(),
        publishedAt: publishedDate,
        initialStatus: this.autoPublishTiers.has(item.sourceTier) ? "published" : "pending_review",
        ...(factEvaluation === undefined
          ? {}
          : {
              factCandidate: {
                ...factEvaluation,
                rawInstitutionName: item.factChange?.toPlace ?? item.institutionName ?? undefined,
                changePayload: (item.factChange ?? {}) as unknown as Record<string, unknown>,
                evidence: {
                  newsItemId: "",
                  sourceUrl,
                  sourceTier: item.sourceTier,
                  sourcePublisher: item.sourcePublisher.trim(),
                  quote: (item.evidenceQuote ?? item.summaryZh).trim(),
                  publishedAt: publishedDate.toISOString(),
                },
              },
            }),
      });
    }

    return this.repository.upsertIngestedBatch(prepared, correlationId);
  }

  public async listPublicNews(query: {
    panda?: string;
    institution?: string;
    sourceTier?: NewsSourceTier;
    limit?: number;
    cursor?: string;
  }): Promise<PublicNewsPage> {
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const cursor = query.cursor ? decodeNewsCursor(query.cursor) : undefined;
    const rows = await this.repository.listPublicNews({
      pandaSlug: query.panda,
      institutionSlug: query.institution,
      sourceTier: query.sourceTier,
      limit: limit + 1,
      cursor,
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    return {
      items,
      ...(hasMore && last !== undefined ? { nextCursor: encodeNewsCursor(last.publishedAt, last.newsItemId) } : {}),
    };
  }

  public listPublishedOfficialVenueNews(institutionSlug?: string): Promise<PublicVenueNewsItem[]> {
    return this.repository.listPublishedOfficialVenueNews(institutionSlug);
  }

  public listReviewItems(query: {
    status?: NewsItemStatus;
    limit?: number;
    offset?: number;
  }): Promise<NewsReviewItem[]> {
    return this.repository.listReviewItems({
      status: query.status,
      limit: Math.min(100, Math.max(1, query.limit ?? 25)),
      offset: Math.max(0, query.offset ?? 0),
    });
  }

  public async decideReviewItem(input: {
    newsItemId: string;
    actorAccountId: string;
    decision: NewsReviewDecision;
    reviewNote?: string;
    pandaSlugs?: string[];
    institutionSlug?: string;
    correlationId: string;
  }): Promise<NewsReviewItem> {
    let pandaIds: string[] | undefined;
    let pandaSlugs: string[] | undefined;
    let primaryPandaName: string | undefined;
    let institutionId: string | undefined;
    let institutionSlug: string | undefined;
    let institutionName: string | undefined;

    if (input.pandaSlugs !== undefined || input.institutionSlug !== undefined) {
      const resolver = createNewsEntityResolver(await this.loadCatalog());
      if (input.pandaSlugs !== undefined) {
        const resolved = resolver.resolvePandaSlugs(input.pandaSlugs);
        if (resolved.length !== input.pandaSlugs.length) {
          throw new DomainError("invalid", "news.unknownPandaSlug", "One or more pandaSlugs do not exist in the active release.");
        }
        pandaIds = resolved.map((item) => item.pandaId);
        pandaSlugs = resolved.map((item) => item.canonicalSlug);
        primaryPandaName = resolved[0]?.name;
      }
      if (input.institutionSlug !== undefined) {
        const resolvedInst = resolver.resolveInstitutionSlug(input.institutionSlug);
        if (resolvedInst === undefined) {
          throw new DomainError("invalid", "news.unknownInstitutionSlug", "institutionSlug does not exist in the active release.");
        }
        institutionId = resolvedInst.institutionId;
        institutionSlug = resolvedInst.slug;
        institutionName = resolvedInst.name;
      }
    }

    const updated = await this.repository.decideReviewItem({
      newsItemId: input.newsItemId,
      actorAccountId: input.actorAccountId,
      decision: input.decision,
      reviewNote: input.reviewNote,
      pandaIds,
      pandaSlugs,
      primaryPandaName,
      institutionId,
      institutionSlug,
      institutionName,
      correlationId: input.correlationId,
    });
    if (updated === undefined) {
      throw new DomainError("not_found", "news.itemNotFound", "The news item does not exist.");
    }
    return updated;
  }

  public listFactCandidates(query: {
    reviewState?: FactReviewState;
    limit?: number;
    offset?: number;
  }): Promise<FactCandidateRecord[]> {
    return this.repository.listFactCandidates({
      reviewState: query.reviewState,
      limit: Math.min(100, Math.max(1, query.limit ?? 25)),
      offset: Math.max(0, query.offset ?? 0),
    });
  }

  public async decideFactCandidate(input: {
    candidateId: string;
    actorAccountId: string;
    decision: "approved" | "rejected";
    reviewNote?: string;
    targetPandaSlug?: string;
    targetInstitutionSlug?: string;
    correlationId: string;
  }): Promise<FactCandidateRecord> {
    let targetPandaId: string | undefined;
    let targetPandaSlug: string | undefined;
    let targetInstitutionId: string | undefined;
    let targetInstitutionSlug: string | undefined;

    if (input.targetPandaSlug !== undefined || input.targetInstitutionSlug !== undefined) {
      const resolver = createNewsEntityResolver(await this.loadCatalog());
      if (input.targetPandaSlug !== undefined) {
        const [resolved] = resolver.resolvePandaSlugs([input.targetPandaSlug]);
        if (resolved === undefined) {
          throw new DomainError("invalid", "news.unknownPandaSlug", "targetPandaSlug does not exist in the active release.");
        }
        targetPandaId = resolved.pandaId;
        targetPandaSlug = resolved.canonicalSlug;
      }
      if (input.targetInstitutionSlug !== undefined) {
        const resolvedInst = resolver.resolveInstitutionSlug(input.targetInstitutionSlug);
        if (resolvedInst === undefined) {
          throw new DomainError("invalid", "news.unknownInstitutionSlug", "targetInstitutionSlug does not exist in the active release.");
        }
        targetInstitutionId = resolvedInst.institutionId;
        targetInstitutionSlug = resolvedInst.slug;
      }
    }

    const updated = await this.repository.decideFactCandidate({
      candidateId: input.candidateId,
      actorAccountId: input.actorAccountId,
      reviewState: input.decision,
      reviewNote: input.reviewNote,
      targetPandaId,
      targetPandaSlug,
      targetInstitutionId,
      targetInstitutionSlug,
      correlationId: input.correlationId,
    });
    if (updated === undefined) {
      throw new DomainError("not_found", "news.factCandidateNotFound", "The fact candidate does not exist.");
    }
    return updated;
  }
}
