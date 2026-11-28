import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { DatabaseService, DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { JsonValue } from "../../../platform/database/database.news.generated.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { PublicVenueNewsItem } from "../../catalog/application/venue-news-catalog.js";
import {
  mapNewsKindToVenueKind,
  type FactCandidateEvidence,
  type FactCandidateRecord,
  type FactReviewState,
  type NewsIngestPersistenceInput,
  type NewsItemStatus,
  type NewsKind,
  type NewsPlatform,
  type NewsRepository,
  type NewsReviewDecision,
  type NewsReviewItem,
  type NewsSourceTier,
  type PublicNewsItem,
} from "../application/news.application.js";

const CST_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatPublishedOnCst(value: Date): string {
  return CST_DAY_FORMATTER.format(value);
}

interface NewsItemRow {
  news_item_id: string;
  external_id: string;
  platform: string;
  source_tier: string;
  source_url: string;
  source_publisher: string;
  title_zh: string;
  summary_zh: string;
  kind: string;
  cover_url: string | null;
  panda_ids: string[];
  panda_slugs: string[];
  raw_panda_names: string[];
  institution_id: string | null;
  institution_slug: string | null;
  institution_name: string | null;
  published_at: Date;
  status: string;
  review_note: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface FactCandidateRow {
  candidate_id: string;
  candidate_key: string;
  news_item_id: string;
  kind: string;
  phase: string | null;
  naming_status: string | null;
  event_date: string | null;
  target_panda_id: string | null;
  target_panda_slug: string | null;
  raw_panda_names: string[];
  target_institution_id: string | null;
  target_institution_slug: string | null;
  raw_institution_name: string | null;
  change_payload: JsonValue;
  evidence_items: JsonValue;
  gate_status: string;
  review_state: string;
  review_note: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

function toPublicNewsItem(row: NewsItemRow): PublicNewsItem {
  return {
    newsItemId: row.news_item_id,
    platform: row.platform as NewsPlatform,
    sourceTier: row.source_tier as NewsSourceTier,
    kind: row.kind as NewsKind,
    titleZh: row.title_zh,
    summaryZh: row.summary_zh,
    sourceUrl: row.source_url,
    sourcePublisher: row.source_publisher,
    ...(row.cover_url !== null ? { coverUrl: row.cover_url } : {}),
    pandaIds: row.panda_ids,
    pandaSlugs: row.panda_slugs,
    ...(row.institution_id !== null ? { institutionId: row.institution_id } : {}),
    ...(row.institution_slug !== null ? { institutionSlug: row.institution_slug } : {}),
    ...(row.institution_name !== null ? { institutionName: row.institution_name } : {}),
    publishedAt: row.published_at.toISOString(),
  };
}

function toReviewNewsItem(row: NewsItemRow): NewsReviewItem {
  return {
    ...toPublicNewsItem(row),
    externalId: row.external_id,
    rawPandaNames: row.raw_panda_names,
    status: row.status as NewsItemStatus,
    ...(row.review_note !== null ? { reviewNote: row.review_note } : {}),
    ...(row.reviewed_at !== null ? { reviewedAt: row.reviewed_at.toISOString() } : {}),
    createdAt: row.created_at.toISOString(),
  };
}

function toFactCandidate(row: FactCandidateRow): FactCandidateRecord {
  const payload =
    row.change_payload !== null && typeof row.change_payload === "object" && !Array.isArray(row.change_payload)
      ? (row.change_payload as Record<string, unknown>)
      : {};
  const evidenceItems = Array.isArray(row.evidence_items)
    ? (row.evidence_items as unknown as FactCandidateEvidence[])
    : [];
  return {
    candidateId: row.candidate_id,
    candidateKey: row.candidate_key,
    newsItemId: row.news_item_id,
    kind: row.kind,
    ...(row.phase !== null ? { phase: row.phase } : {}),
    ...(row.naming_status !== null ? { namingStatus: row.naming_status } : {}),
    ...(row.event_date !== null ? { eventDate: row.event_date } : {}),
    ...(row.target_panda_id !== null ? { targetPandaId: row.target_panda_id } : {}),
    ...(row.target_panda_slug !== null ? { targetPandaSlug: row.target_panda_slug } : {}),
    rawPandaNames: row.raw_panda_names,
    ...(row.target_institution_id !== null ? { targetInstitutionId: row.target_institution_id } : {}),
    ...(row.target_institution_slug !== null ? { targetInstitutionSlug: row.target_institution_slug } : {}),
    ...(row.raw_institution_name !== null ? { rawInstitutionName: row.raw_institution_name } : {}),
    changePayload: payload,
    evidenceItems,
    gateStatus: row.gate_status,
    reviewState: row.review_state as FactReviewState,
    ...(row.review_note !== null ? { reviewNote: row.review_note } : {}),
    ...(row.reviewed_at !== null ? { reviewedAt: row.reviewed_at.toISOString() } : {}),
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresNewsRepository implements NewsRepository {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
  ) {}

  public async upsertIngestedBatch(
    items: readonly NewsIngestPersistenceInput[],
    correlationId: string,
  ): Promise<{ accepted: number; published: number; pendingReview: number; factCandidatesCreated: number }> {
    return this.database.transaction(async (transaction) => {
      let published = 0;
      let pendingReview = 0;
      let factCandidatesCreated = 0;
      const now = new Date();

      for (const item of items) {
        const existing = await transaction
          .selectFrom("news.items")
          .select(["news_item_id", "status"])
          .where("external_id", "=", item.externalId)
          .forUpdate()
          .executeTakeFirst();

        let newsItemId: string;
        let finalStatus: NewsItemStatus;

        if (existing === undefined) {
          const inserted = await transaction
            .insertInto("news.items")
            .values({
              external_id: item.externalId,
              platform: item.platform,
              source_tier: item.sourceTier,
              source_url: item.sourceUrl,
              source_publisher: item.sourcePublisher,
              title_zh: item.titleZh,
              summary_zh: item.summaryZh,
              kind: item.kind,
              cover_url: item.coverUrl ?? null,
              panda_ids: item.pandaIds,
              panda_slugs: item.pandaSlugs,
              raw_panda_names: item.rawPandaNames,
              institution_id: item.institutionId ?? null,
              institution_slug: item.institutionSlug ?? null,
              institution_name: item.institutionName ?? null,
              published_at: item.publishedAt,
              status: item.initialStatus,
            })
            .returning("news_item_id")
            .executeTakeFirstOrThrow();
          newsItemId = inserted.news_item_id;
          finalStatus = item.initialStatus;
          if (finalStatus === "published") published += 1;
          else pendingReview += 1;
        } else {
          newsItemId = existing.news_item_id;
          const preservedStatus = existing.status as NewsItemStatus;
          // Hidden or rejected items must never resurrect when re-ingested.
          if (preservedStatus === "hidden" || preservedStatus === "rejected") {
            finalStatus = preservedStatus;
          } else {
            finalStatus =
              preservedStatus === "published" ? "published" : item.initialStatus;
            await transaction
              .updateTable("news.items")
              .set({
                platform: item.platform,
                source_tier: item.sourceTier,
                source_url: item.sourceUrl,
                source_publisher: item.sourcePublisher,
                title_zh: item.titleZh,
                summary_zh: item.summaryZh,
                kind: item.kind,
                cover_url: item.coverUrl ?? null,
                panda_ids: item.pandaIds,
                panda_slugs: item.pandaSlugs,
                raw_panda_names: item.rawPandaNames,
                institution_id: item.institutionId ?? null,
                institution_slug: item.institutionSlug ?? null,
                institution_name: item.institutionName ?? null,
                published_at: item.publishedAt,
                status: finalStatus,
                updated_at: now,
              })
              .where("news_item_id", "=", newsItemId)
              .executeTakeFirstOrThrow();
            if (preservedStatus !== "published" && finalStatus === "published") {
              published += 1;
            }
          }
        }

        if (finalStatus === "published") {
          await this.emitPublishedOutboxEvents(transaction, {
            newsItemId,
            sourceTier: item.sourceTier,
            titleZh: item.titleZh,
            summaryZh: item.summaryZh,
            sourceUrl: item.sourceUrl,
            pandaIds: item.pandaIds,
            pandaSlug: item.pandaSlugs[0],
            pandaName: item.primaryPandaName ?? item.rawPandaNames[0],
            institutionId: item.institutionId,
            institutionSlug: item.institutionSlug,
            institutionName: item.institutionName,
            occurredAt: now,
            correlationId,
          });
        }

        if (item.factCandidate !== undefined) {
          const created = await this.upsertFactCandidate(transaction, {
            newsItemId,
            factCandidate: item.factCandidate,
            rawPandaNames: item.rawPandaNames,
            now,
          });
          if (created) factCandidatesCreated += 1;
        }
      }

      return {
        accepted: items.length,
        published,
        pendingReview,
        factCandidatesCreated,
      };
    });
  }

  private async emitPublishedOutboxEvents(
    transaction: DatabaseTransaction,
    input: {
      newsItemId: string;
      sourceTier: NewsSourceTier;
      titleZh: string;
      summaryZh: string;
      sourceUrl: string;
      pandaIds: readonly string[];
      pandaSlug?: string;
      pandaName?: string;
      institutionId?: string;
      institutionSlug?: string;
      institutionName?: string;
      occurredAt: Date;
      correlationId: string;
    },
  ): Promise<void> {
    if (input.pandaIds.length > 0) {
      await this.outbox.appendIfAbsent(transaction, {
        eventType: "news.panda_item.published",
        sourceContext: "news",
        aggregateType: "news_item",
        aggregateId: input.newsItemId,
        idempotencyKey: `news:panda:${input.newsItemId}`,
        correlationId: input.correlationId,
        occurredAt: input.occurredAt,
        payload: {
          pandaIds: [...input.pandaIds],
          pandaId: input.pandaIds[0]!,
          ...(input.pandaSlug ? { pandaSlug: input.pandaSlug } : {}),
          ...(input.pandaName ? { pandaName: input.pandaName } : {}),
          title: input.titleZh,
          summary: input.summaryZh,
          sourceUrl: input.sourceUrl,
        },
      });
    }

    if (input.sourceTier === "institution" && input.institutionId !== undefined) {
      await this.outbox.appendIfAbsent(transaction, {
        eventType: "news.venue_item.published",
        sourceContext: "news",
        aggregateType: "news_item",
        aggregateId: input.newsItemId,
        idempotencyKey: `news:venue:${input.newsItemId}`,
        correlationId: input.correlationId,
        occurredAt: input.occurredAt,
        payload: {
          institutionIds: [input.institutionId],
          institutionId: input.institutionId,
          ...(input.institutionSlug ? { institutionSlug: input.institutionSlug } : {}),
          ...(input.institutionName ? { institutionName: input.institutionName } : {}),
          title: input.titleZh,
          summary: input.summaryZh,
          sourceUrl: input.sourceUrl,
        },
      });
    }
  }

  private async upsertFactCandidate(
    transaction: DatabaseTransaction,
    input: {
      newsItemId: string;
      factCandidate: NonNullable<NewsIngestPersistenceInput["factCandidate"]>;
      rawPandaNames: string[];
      now: Date;
    },
  ): Promise<boolean> {
    const fc = input.factCandidate;
    const evidenceItem: FactCandidateEvidence = {
      ...fc.evidence,
      newsItemId: input.newsItemId,
    };

    const existing = await transaction
      .selectFrom("news.fact_candidates")
      .select(["candidate_id", "evidence_items"])
      .where("candidate_key", "=", fc.candidateKey)
      .forUpdate()
      .executeTakeFirst();

    if (existing === undefined) {
      await transaction
        .insertInto("news.fact_candidates")
        .values({
          candidate_key: fc.candidateKey,
          news_item_id: input.newsItemId,
          kind: fc.kind,
          phase: fc.phase ?? null,
          naming_status: fc.namingStatus ?? null,
          event_date: fc.eventDate ?? null,
          target_panda_id: fc.targetPandaId ?? null,
          target_panda_slug: fc.targetPandaSlug ?? null,
          raw_panda_names: input.rawPandaNames,
          target_institution_id: fc.targetInstitutionId ?? null,
          target_institution_slug: fc.targetInstitutionSlug ?? null,
          raw_institution_name: fc.rawInstitutionName ?? null,
          change_payload: sql`${JSON.stringify(fc.changePayload)}::jsonb`,
          evidence_items: sql`${JSON.stringify([evidenceItem])}::jsonb`,
          gate_status: fc.gateStatus,
          review_state: fc.reviewState,
        })
        .execute();
      return true;
    }

    const currentEvidence = Array.isArray(existing.evidence_items)
      ? (existing.evidence_items as unknown as FactCandidateEvidence[])
      : [];
    const alreadyRecorded = currentEvidence.some(
      (entry) => entry.newsItemId === input.newsItemId || entry.sourceUrl === evidenceItem.sourceUrl,
    );
    if (!alreadyRecorded) {
      const nextEvidence = [...currentEvidence, evidenceItem];
      await transaction
        .updateTable("news.fact_candidates")
        .set({
          evidence_items: sql`${JSON.stringify(nextEvidence)}::jsonb`,
          updated_at: input.now,
        })
        .where("candidate_id", "=", existing.candidate_id)
        .executeTakeFirstOrThrow();
    }
    return false;
  }

  public async listPublicNews(query: {
    pandaSlug?: string;
    institutionSlug?: string;
    sourceTier?: NewsSourceTier;
    limit: number;
    cursor?: { publishedAt: string; newsItemId: string };
  }): Promise<PublicNewsItem[]> {
    let builder = this.database.db
      .selectFrom("news.items")
      .selectAll()
      .where("status", "=", "published");

    if (query.pandaSlug !== undefined) {
      builder = builder.where(sql<boolean>`panda_slugs @> array[${query.pandaSlug}]::text[]`);
    }
    if (query.institutionSlug !== undefined) {
      builder = builder.where("institution_slug", "=", query.institutionSlug);
    }
    if (query.sourceTier !== undefined) {
      builder = builder.where("source_tier", "=", query.sourceTier);
    }
    if (query.cursor !== undefined) {
      builder = builder.where(
        sql<boolean>`(published_at, news_item_id) < (${new Date(query.cursor.publishedAt)}, ${query.cursor.newsItemId}::uuid)`,
      );
    }

    const rows = await builder
      .orderBy("published_at", "desc")
      .orderBy("news_item_id", "desc")
      .limit(query.limit)
      .execute();
    return rows.map((row) => toPublicNewsItem(row as unknown as NewsItemRow));
  }

  public async listPublishedOfficialVenueNews(
    institutionSlug?: string,
    limit = 40,
  ): Promise<PublicVenueNewsItem[]> {
    let builder = this.database.db
      .selectFrom("news.items")
      .selectAll()
      .where("status", "=", "published")
      .where("source_tier", "=", "institution")
      .where("institution_slug", "is not", null);

    if (institutionSlug !== undefined) {
      builder = builder.where("institution_slug", "=", institutionSlug);
    }

    const rows = await builder
      .orderBy("published_at", "desc")
      .orderBy("news_item_id", "desc")
      .limit(limit)
      .execute();

    return rows.map((raw) => {
      const row = raw as unknown as NewsItemRow;
      return {
        id: row.news_item_id,
        institutionSlug: row.institution_slug!,
        kind: mapNewsKindToVenueKind(row.kind as NewsKind),
        headline: row.title_zh,
        pandaSlugs: row.panda_slugs,
        sourceUrl: row.source_url,
        sourcePublisher: row.source_publisher,
        publishedOn: formatPublishedOnCst(row.published_at),
        updatedAt: row.updated_at.toISOString(),
      };
    });
  }

  public async listReviewItems(query: {
    status?: NewsItemStatus;
    limit: number;
    offset: number;
  }): Promise<NewsReviewItem[]> {
    let builder = this.database.db.selectFrom("news.items").selectAll();
    if (query.status !== undefined) {
      builder = builder.where("status", "=", query.status);
    }
    const rows = await builder
      .orderBy("created_at", "desc")
      .orderBy("news_item_id", "desc")
      .limit(query.limit)
      .offset(query.offset)
      .execute();
    return rows.map((row) => toReviewNewsItem(row as unknown as NewsItemRow));
  }

  public async decideReviewItem(input: {
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
  }): Promise<NewsReviewItem | undefined> {
    const nextStatus: NewsItemStatus =
      input.decision === "publish" ? "published" : input.decision === "reject" ? "rejected" : "hidden";

    return this.database.transaction(async (transaction) => {
      const existing = await transaction
        .selectFrom("news.items")
        .selectAll()
        .where("news_item_id", "=", input.newsItemId)
        .forUpdate()
        .executeTakeFirst();
      if (existing === undefined) return undefined;

      const now = new Date();
      const updated = await transaction
        .updateTable("news.items")
        .set({
          status: nextStatus,
          review_note: input.reviewNote ?? existing.review_note,
          reviewed_by_account_id: input.actorAccountId,
          reviewed_at: now,
          updated_at: now,
          ...(input.pandaIds !== undefined ? { panda_ids: input.pandaIds } : {}),
          ...(input.pandaSlugs !== undefined ? { panda_slugs: input.pandaSlugs } : {}),
          ...(input.institutionId !== undefined ? { institution_id: input.institutionId } : {}),
          ...(input.institutionSlug !== undefined ? { institution_slug: input.institutionSlug } : {}),
          ...(input.institutionName !== undefined ? { institution_name: input.institutionName } : {}),
        })
        .where("news_item_id", "=", input.newsItemId)
        .returningAll()
        .executeTakeFirstOrThrow();

      if (nextStatus === "published") {
        await this.emitPublishedOutboxEvents(transaction, {
          newsItemId: updated.news_item_id,
          sourceTier: updated.source_tier as NewsSourceTier,
          titleZh: updated.title_zh,
          summaryZh: updated.summary_zh,
          sourceUrl: updated.source_url,
          pandaIds: updated.panda_ids,
          pandaSlug: updated.panda_slugs[0],
          pandaName: input.primaryPandaName ?? updated.raw_panda_names[0],
          institutionId: updated.institution_id ?? undefined,
          institutionSlug: updated.institution_slug ?? undefined,
          institutionName: updated.institution_name ?? undefined,
          occurredAt: now,
          correlationId: input.correlationId,
        });
      }

      await this.outbox.append(transaction, {
        eventType: "news.item.moderated",
        sourceContext: "news",
        aggregateType: "news_item",
        aggregateId: updated.news_item_id,
        idempotencyKey: `news:moderated:${updated.news_item_id}:${randomUUID()}`,
        correlationId: input.correlationId,
        occurredAt: now,
        payload: {
          newsItemId: updated.news_item_id,
          actorAccountId: input.actorAccountId,
          decision: input.decision,
          previousStatus: existing.status,
          nextStatus,
        },
      });

      return toReviewNewsItem(updated);
    });
  }

  public async listFactCandidates(query: {
    reviewState?: FactReviewState;
    limit: number;
    offset: number;
  }): Promise<FactCandidateRecord[]> {
    let builder = this.database.db.selectFrom("news.fact_candidates").selectAll();
    if (query.reviewState !== undefined) {
      builder = builder.where("review_state", "=", query.reviewState);
    }
    const rows = await builder
      .orderBy("created_at", "desc")
      .orderBy("candidate_id", "desc")
      .limit(query.limit)
      .offset(query.offset)
      .execute();
    return rows.map((row) => toFactCandidate(row as unknown as FactCandidateRow));
  }

  public async decideFactCandidate(input: {
    candidateId: string;
    actorAccountId: string;
    reviewState: "approved" | "rejected";
    reviewNote?: string;
    targetPandaId?: string;
    targetPandaSlug?: string;
    targetInstitutionId?: string;
    targetInstitutionSlug?: string;
    correlationId: string;
  }): Promise<FactCandidateRecord | undefined> {
    return this.database.transaction(async (transaction) => {
      const existing = await transaction
        .selectFrom("news.fact_candidates")
        .selectAll()
        .where("candidate_id", "=", input.candidateId)
        .forUpdate()
        .executeTakeFirst();
      if (existing === undefined) return undefined;

      const now = new Date();
      const updated = await transaction
        .updateTable("news.fact_candidates")
        .set({
          review_state: input.reviewState,
          review_note: input.reviewNote ?? existing.review_note,
          reviewed_by_account_id: input.actorAccountId,
          reviewed_at: now,
          updated_at: now,
          ...(input.targetPandaId !== undefined ? { target_panda_id: input.targetPandaId } : {}),
          ...(input.targetPandaSlug !== undefined ? { target_panda_slug: input.targetPandaSlug } : {}),
          ...(input.targetInstitutionId !== undefined ? { target_institution_id: input.targetInstitutionId } : {}),
          ...(input.targetInstitutionSlug !== undefined
            ? { target_institution_slug: input.targetInstitutionSlug }
            : {}),
        })
        .where("candidate_id", "=", input.candidateId)
        .returningAll()
        .executeTakeFirstOrThrow();

      await this.outbox.append(transaction, {
        eventType: "news.fact_candidate.reviewed",
        sourceContext: "news",
        aggregateType: "news_fact_candidate",
        aggregateId: updated.candidate_id,
        idempotencyKey: `news:fact:${updated.candidate_id}:${randomUUID()}`,
        correlationId: input.correlationId,
        occurredAt: now,
        payload: {
          candidateId: updated.candidate_id,
          actorAccountId: input.actorAccountId,
          previousState: existing.review_state,
          reviewState: input.reviewState,
        },
      });

      return toFactCandidate(updated);
    });
  }
}
