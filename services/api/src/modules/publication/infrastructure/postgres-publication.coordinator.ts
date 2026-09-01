import { sql } from "kysely";
import type { EvidencePublicationPort } from "../../evidence/application/evidence-publication.application.js";
import type { LifeHistoryPublicationPort } from "../../life-history/application/life-history-publication.application.js";
import type { LineagePublicationPort } from "../../lineage/application/lineage-publication.application.js";
import type { MediaPublicationPort } from "../../media/application/media-publication.application.js";
import type { PandaPublicationPort } from "../../panda/application/panda-publication.application.js";
import type { PlacesPublicationPort } from "../../places/application/places-publication.application.js";
import type { DatabaseService, DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { Json as PublicReadJson } from "../../../platform/database/database.public-read.generated.js";
import { sha256Content } from "../../../platform/integrity/content-digest.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type {
  PublicRelease,
  PublicationCommandContext,
  PublicationCoordinator,
  PublicationReleaseResult,
  PublicationResourceKind,
  ReleaseLifecycleState,
} from "../application/publication.application.js";

interface MembershipInput {
  resourceKind: string;
  resourceId: string;
  sourceRevision: string;
  sourceVersion: string;
  sourceSha256: string;
  projectionSha256: string;
}

interface ReleaseRow {
  release_id: string;
  version: string;
  projection_schema_version: number;
  lifecycle_state: string;
  built_at: Date;
  sealed_at: Date | null;
  content_sha256: string | null;
  created_at: Date;
}

function actorAccountId(context: PublicationCommandContext): string | null {
  return context.actor.kind === "account" ? context.actor.accountId : null;
}

function actorSystemKey(context: PublicationCommandContext): string | null {
  return context.actor.kind === "system" ? context.actor.systemKey : null;
}

export class PostgresPublicationCoordinator implements PublicationCoordinator {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
    private readonly evidence: EvidencePublicationPort,
    private readonly pandas: PandaPublicationPort,
    private readonly places: PlacesPublicationPort,
    private readonly lifeHistory: LifeHistoryPublicationPort,
    private readonly lineage: LineagePublicationPort,
    private readonly media: MediaPublicationPort,
  ) {}

  public async build(version: string, context: PublicationCommandContext): Promise<PublicRelease> {
    return this.database.db
      .transaction()
      .setIsolationLevel("repeatable read")
      .execute(async (transaction) => {
        const release = await transaction
          .insertInto("publication.releases")
          .values({
            version,
            created_by_account_id: actorAccountId(context),
            created_by_system_key: actorSystemKey(context),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const evidence = await this.evidence.snapshot(transaction);
        const pandas = await this.pandas.snapshot(transaction);
        const places = await this.places.snapshot(transaction);
        const lifeHistory = await this.lifeHistory.snapshot(transaction);
        const lineage = await this.lineage.snapshot(transaction);
        const media = await this.media.snapshot(transaction);
        const memberships: MembershipInput[] = [];

        if (pandas.length > 0) {
          await transaction
            .insertInto("public_read.pandas")
            .values(
              pandas.map((item) => {
                const projection = {
                  pandaId: item.pandaId,
                  canonicalSlug: item.canonicalSlug,
                  legacySlugs: item.legacySlugs,
                  names: item.names,
                  facts: item.facts,
                  evidenceSourceIds: item.evidenceSourceIds,
                };
                memberships.push(this.membership("panda", item.pandaId, item, projection));
                return {
                  release_id: release.release_id,
                  panda_id: item.pandaId,
                  canonical_slug: item.canonicalSlug,
                  legacy_slugs: item.legacySlugs,
                  names: sql<PublicReadJson>`${JSON.stringify(item.names)}::jsonb`,
                  facts: sql<PublicReadJson>`${JSON.stringify(item.facts)}::jsonb`,
                  evidence_source_ids: item.evidenceSourceIds,
                };
              }),
            )
            .execute();
        }

        if (places.institutions.length > 0) {
          await transaction
            .insertInto("public_read.institutions")
            .values(
              places.institutions.map((item) => {
                const projection = {
                  institutionId: item.institutionId,
                  slug: item.slug,
                  nameZh: item.nameZh,
                  nameEn: item.nameEn,
                  countryCode: item.countryCode,
                };
                memberships.push(this.membership("institution", item.institutionId, item, projection));
                return {
                  release_id: release.release_id,
                  institution_id: item.institutionId,
                  slug: item.slug,
                  name_zh: item.nameZh ?? null,
                  name_en: item.nameEn ?? null,
                  country_code: item.countryCode ?? null,
                };
              }),
            )
            .execute();
        }

        if (places.places.length > 0) {
          await transaction
            .insertInto("public_read.places")
            .values(
              places.places.map((item) => {
                const projection = {
                  placeId: item.placeId,
                  institutionId: item.institutionId,
                  slug: item.slug,
                  placeType: item.placeType,
                  nameZh: item.nameZh,
                  nameEn: item.nameEn,
                  countryCode: item.countryCode,
                  region: item.region,
                  longitude: item.longitude,
                  latitude: item.latitude,
                };
                memberships.push(this.membership("place", item.placeId, item, projection));
                return {
                  release_id: release.release_id,
                  place_id: item.placeId,
                  institution_id: item.institutionId ?? null,
                  slug: item.slug,
                  place_type: item.placeType,
                  name_zh: item.nameZh ?? null,
                  name_en: item.nameEn ?? null,
                  country_code: item.countryCode ?? null,
                  region: item.region ?? null,
                  longitude: item.longitude ?? null,
                  latitude: item.latitude ?? null,
                };
              }),
            )
            .execute();
        }

        if (lineage.length > 0) {
          await transaction
            .insertInto("public_read.lineage")
            .values(
              lineage.map((item) => {
                const projection = {
                  assertionId: item.assertionId,
                  childId: item.childId,
                  parentId: item.parentId,
                  parentRole: item.parentRole,
                  sourceIds: item.sourceIds,
                };
                memberships.push(this.membership("lineage", item.assertionId, item, projection));
                return {
                  release_id: release.release_id,
                  assertion_id: item.assertionId,
                  child_id: item.childId,
                  parent_id: item.parentId,
                  parent_role: item.parentRole,
                  source_ids: item.sourceIds,
                };
              }),
            )
            .execute();
        }

        if (lifeHistory.residencies.length > 0) {
          await transaction
            .insertInto("public_read.residencies")
            .values(
              lifeHistory.residencies.map((item) => {
                const projection = {
                  residencyId: item.residencyId,
                  pandaId: item.pandaId,
                  placeId: item.placeId,
                  residencyType: item.residencyType,
                  startOn: item.startOn,
                  startPrecision: item.startPrecision,
                  endOn: item.endOn,
                  endPrecision: item.endPrecision,
                  status: item.status,
                  sourceIds: item.sourceIds,
                };
                memberships.push(this.membership("residency", item.residencyId, item, projection));
                return {
                  release_id: release.release_id,
                  residency_id: item.residencyId,
                  panda_id: item.pandaId,
                  place_id: item.placeId,
                  residency_type: item.residencyType,
                  start_on: item.startOn ?? null,
                  start_precision: item.startPrecision,
                  end_on: item.endOn ?? null,
                  end_precision: item.endPrecision ?? null,
                  status: item.status,
                  source_ids: item.sourceIds,
                };
              }),
            )
            .execute();
        }

        if (lifeHistory.events.length > 0) {
          await transaction
            .insertInto("public_read.life_events")
            .values(
              lifeHistory.events.map((item) => {
                const projection = {
                  eventId: item.eventId,
                  eventType: item.eventType,
                  eventStatus: item.eventStatus,
                  occurredOn: item.occurredOn,
                  occurredPrecision: item.occurredPrecision,
                  fromPlaceId: item.fromPlaceId,
                  toPlaceId: item.toPlaceId,
                  summary: item.summary,
                  participantIds: item.participantIds,
                  sourceIds: item.sourceIds,
                };
                memberships.push(this.membership("life_event", item.eventId, item, projection));
                return {
                  release_id: release.release_id,
                  event_id: item.eventId,
                  event_type: item.eventType,
                  event_status: item.eventStatus,
                  occurred_on: item.occurredOn ?? null,
                  occurred_precision: item.occurredPrecision,
                  from_place_id: item.fromPlaceId ?? null,
                  to_place_id: item.toPlaceId ?? null,
                  summary: item.summary ?? null,
                  participant_ids: item.participantIds,
                  source_ids: item.sourceIds,
                };
              }),
            )
            .execute();
        }

        if (media.length > 0) {
          await transaction
            .insertInto("public_read.media")
            .values(
              media.map((item) => {
                const projection = {
                  assetId: item.assetId,
                  pandaId: item.pandaId,
                  sourceId: item.sourceId,
                  usageRole: item.usageRole,
                  displayOrder: item.displayOrder,
                  objectKey: item.objectKey,
                  contentSha256: item.contentSha256,
                  mediaType: item.mediaType,
                  title: item.title,
                  creator: item.creator,
                  copyrightText: item.copyrightText,
                  license: item.license,
                  attributionText: item.attributionText,
                  takenAt: item.takenAt,
                };
                memberships.push(this.membership("media", item.membershipId, item, projection));
                return {
                  release_id: release.release_id,
                  asset_id: item.assetId,
                  panda_id: item.pandaId,
                  source_id: item.sourceId ?? null,
                  usage_role: item.usageRole,
                  display_order: item.displayOrder,
                  object_key: item.objectKey,
                  content_sha256: item.contentSha256,
                  media_type: item.mediaType,
                  title: item.title ?? null,
                  creator: item.creator ?? null,
                  copyright_text: item.copyrightText ?? null,
                  license: item.license ?? null,
                  attribution_text: item.attributionText ?? null,
                  taken_at: item.takenAt ?? null,
                };
              }),
            )
            .execute();
        }

        if (evidence.length > 0) {
          await transaction
            .insertInto("public_read.evidence_sources")
            .values(
              evidence.map((item) => {
                const projection = {
                  sourceId: item.sourceId,
                  publisher: item.publisher,
                  title: item.title,
                  url: item.url,
                  publishedOn: item.publishedOn,
                  lastVerifiedOn: item.lastVerifiedOn,
                  languageTag: item.languageTag,
                  accessState: item.accessState,
                  evidenceTier: item.evidenceTier,
                  publicSummary: item.publicSummary,
                };
                memberships.push(this.membership("evidence", item.sourceId, item, projection));
                return {
                  release_id: release.release_id,
                  source_id: item.sourceId,
                  publisher: item.publisher,
                  title: item.title,
                  url: item.url,
                  published_on: item.publishedOn ?? null,
                  last_verified_on: item.lastVerifiedOn,
                  language_tag: item.languageTag,
                  access_state: item.accessState,
                  evidence_tier: item.evidenceTier ?? null,
                  public_summary: item.publicSummary ?? null,
                };
              }),
            )
            .execute();
        }

        await transaction
          .insertInto("public_read.stats")
          .values({
            release_id: release.release_id,
            panda_count: pandas.length,
            institution_count: places.institutions.length,
            place_count: places.places.length,
            lineage_count: lineage.length,
            residency_count: lifeHistory.residencies.length,
            life_event_count: lifeHistory.events.length,
            media_count: media.length,
            evidence_source_count: evidence.length,
          })
          .execute();

        if (memberships.length > 0) {
          await transaction
            .insertInto("publication.release_memberships")
            .values(
              memberships.map((membership) => ({
                release_id: release.release_id,
                resource_kind: membership.resourceKind,
                resource_id: membership.resourceId,
                source_revision: membership.sourceRevision,
                source_version: membership.sourceVersion,
                source_sha256: membership.sourceSha256,
                projection_sha256: membership.projectionSha256,
              })),
            )
            .execute();
        }

        await transaction
          .insertInto("publication.release_transitions")
          .values({
            release_id: release.release_id,
            transition_type: "built",
            actor_account_id: actorAccountId(context),
            actor_system_key: actorSystemKey(context),
            reason: `Built immutable public projection for ${version}`,
          })
          .execute();

        return this.mapRelease(release as ReleaseRow);
      });
  }

  public async seal(
    releaseId: string,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult> {
    return this.database.transaction(async (transaction) => {
      const release = await this.lockRelease(transaction, releaseId);
      if (release === undefined) return { kind: "not_found" };
      if (release.lifecycle_state === "sealed") return { kind: "ok", release: this.mapRelease(release) };

      const memberships = await transaction
        .selectFrom("publication.release_memberships")
        .select([
          "resource_kind",
          "resource_id",
          "source_revision",
          "source_version",
          "source_sha256",
          "projection_sha256",
        ])
        .where("release_id", "=", releaseId)
        .orderBy("resource_kind")
        .orderBy("resource_id")
        .execute();
      if (memberships.length === 0) return { kind: "not_ready" };

      const contentSha256 = sha256Content(memberships);
      const sealedAt = new Date();
      const sealed = await transaction
        .updateTable("publication.releases")
        .set({ lifecycle_state: "sealed", sealed_at: sealedAt, content_sha256: contentSha256 })
        .where("release_id", "=", releaseId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto("publication.release_transitions")
        .values({
          release_id: releaseId,
          transition_type: "sealed",
          actor_account_id: actorAccountId(context),
            actor_system_key: actorSystemKey(context),
          reason,
          occurred_at: sealedAt,
        })
        .execute();
      return { kind: "ok", release: this.mapRelease(sealed as ReleaseRow) };
    });
  }

  public activate(
    releaseId: string,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult> {
    return this.switchCurrent(releaseId, "activated", context, reason);
  }

  public rollback(
    releaseId: string,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult> {
    return this.switchCurrent(releaseId, "rolled_back", context, reason);
  }

  public async setReleaseSuspension(
    releaseId: string,
    suspended: boolean,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult> {
    return this.database.transaction(async (transaction) => {
      const release = await this.lockRelease(transaction, releaseId);
      if (release === undefined) return { kind: "not_found" };
      if (release.lifecycle_state !== "sealed") return { kind: "not_ready" };
      const now = new Date();
      await transaction
        .insertInto("publication.delivery_control_events")
        .values({
          control_kind: "release_suspension",
          release_id: releaseId,
          action: suspended ? "apply" : "restore",
          actor_account_id: actorAccountId(context),
            actor_system_key: actorSystemKey(context),
          reason,
          occurred_at: now,
        })
        .execute();
      const transition = await transaction
        .insertInto("publication.release_transitions")
        .values({
          release_id: releaseId,
          transition_type: suspended ? "suspended" : "restored",
          actor_account_id: actorAccountId(context),
            actor_system_key: actorSystemKey(context),
          reason,
          occurred_at: now,
        })
        .returning("transition_id")
        .executeTakeFirstOrThrow();
      await this.outbox.append(transaction, {
        eventType: suspended ? "publication.release.suspended" : "publication.release.restored",
        sourceContext: "publication",
        aggregateType: "public_release",
        aggregateId: releaseId,
        idempotencyKey: `release-control:${transition.transition_id}`,
        correlationId: context.correlationId,
        occurredAt: now,
        payload: { releaseId, suspended },
      });
      return { kind: "ok", release: this.mapRelease(release) };
    });
  }

  public async setResourceTakedown(
    resourceKind: PublicationResourceKind,
    resourceId: string,
    takenDown: boolean,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const now = new Date();
      const control = await transaction
        .insertInto("publication.delivery_control_events")
        .values({
          control_kind: "resource_takedown",
          resource_kind: resourceKind,
          resource_id: resourceId,
          action: takenDown ? "apply" : "restore",
          actor_account_id: actorAccountId(context),
            actor_system_key: actorSystemKey(context),
          reason,
          occurred_at: now,
        })
        .returning("control_event_id")
        .executeTakeFirstOrThrow();
      await this.outbox.append(transaction, {
        eventType: takenDown ? "publication.resource.taken_down" : "publication.resource.restored",
        sourceContext: "publication",
        aggregateType: resourceKind,
        aggregateId: resourceId,
        idempotencyKey: `resource-control:${control.control_event_id}`,
        correlationId: context.correlationId,
        occurredAt: now,
        payload: { resourceKind, resourceId, takenDown },
      });
    });
  }

  public async getRelease(releaseId: string): Promise<PublicRelease | undefined> {
    const row = await this.database.db
      .selectFrom("publication.releases")
      .selectAll()
      .where("release_id", "=", releaseId)
      .executeTakeFirst();
    return row === undefined ? undefined : this.mapRelease(row as ReleaseRow);
  }

  private async switchCurrent(
    releaseId: string,
    transitionType: "activated" | "rolled_back",
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult> {
    return this.database.transaction(async (transaction) => {
      const target = await this.lockRelease(transaction, releaseId);
      if (target === undefined) return { kind: "not_found" };
      if (target.lifecycle_state !== "sealed") return { kind: "not_ready" };
      if (await this.isReleaseSuspended(transaction, releaseId)) return { kind: "suspended" };

      const pointer = await transaction
        .selectFrom("publication.current_release")
        .select("release_id")
        .where("singleton", "=", true)
        .forUpdate()
        .executeTakeFirst();
      if (pointer?.release_id === releaseId) {
        return { kind: "already_current", release: this.mapRelease(target) };
      }

      let current: ReleaseRow | undefined;
      if (pointer !== undefined) {
        current = (await transaction
          .selectFrom("publication.releases")
          .selectAll()
          .where("release_id", "=", pointer.release_id)
          .executeTakeFirst()) as ReleaseRow | undefined;
      }

      if (transitionType === "rolled_back") {
        if (current === undefined) return { kind: "not_ready" };
        if (target.projection_schema_version !== current.projection_schema_version) return { kind: "incompatible" };
        if (target.built_at >= current.built_at) return { kind: "not_older" };
      } else if (current !== undefined && target.built_at <= current.built_at) {
        return { kind: "not_forward" };
      }

      const now = new Date();
      if (pointer === undefined) {
        await transaction
          .insertInto("publication.current_release")
          .values({ singleton: true, release_id: releaseId, updated_at: now })
          .execute();
      } else {
        await transaction
          .updateTable("publication.current_release")
          .set({ release_id: releaseId, updated_at: now })
          .where("singleton", "=", true)
          .executeTakeFirstOrThrow();
      }

      const transition = await transaction
        .insertInto("publication.release_transitions")
        .values({
          release_id: releaseId,
          transition_type: transitionType,
          from_release_id: current?.release_id ?? null,
          actor_account_id: actorAccountId(context),
            actor_system_key: actorSystemKey(context),
          reason,
          occurred_at: now,
        })
        .returning("transition_id")
        .executeTakeFirstOrThrow();
      await this.outbox.append(transaction, {
        eventType:
          transitionType === "rolled_back" ? "publication.release.rolled_back" : "publication.release.activated",
        sourceContext: "publication",
        aggregateType: "public_release",
        aggregateId: releaseId,
        idempotencyKey: `release-transition:${transition.transition_id}`,
        correlationId: context.correlationId,
        occurredAt: now,
        payload: {
          releaseId,
          version: target.version,
          previousReleaseId: current?.release_id ?? null,
        },
      });
      return {
        kind: "ok",
        release: this.mapRelease(target),
        ...(current === undefined ? {} : { previousReleaseId: current.release_id }),
      };
    });
  }

  private async lockRelease(transaction: DatabaseTransaction, releaseId: string): Promise<ReleaseRow | undefined> {
    return (await transaction
      .selectFrom("publication.releases")
      .selectAll()
      .where("release_id", "=", releaseId)
      .forUpdate()
      .executeTakeFirst()) as ReleaseRow | undefined;
  }

  private async isReleaseSuspended(transaction: DatabaseTransaction, releaseId: string): Promise<boolean> {
    const event = await transaction
      .selectFrom("publication.delivery_control_events")
      .select("action")
      .where("control_kind", "=", "release_suspension")
      .where("release_id", "=", releaseId)
      .orderBy("occurred_at", "desc")
      .orderBy("control_event_id", "desc")
      .executeTakeFirst();
    return event?.action === "apply";
  }

  private membership(
    resourceKind: string,
    resourceId: string,
    source: { sourceRevision: string; sourceVersion: string; sourceSha256: string },
    projection: unknown,
  ): MembershipInput {
    return {
      resourceKind,
      resourceId,
      sourceRevision: source.sourceRevision,
      sourceVersion: source.sourceVersion,
      sourceSha256: source.sourceSha256,
      projectionSha256: sha256Content(projection),
    };
  }

  private mapRelease(row: ReleaseRow): PublicRelease {
    return {
      releaseId: row.release_id,
      version: row.version,
      projectionSchemaVersion: row.projection_schema_version,
      lifecycleState: row.lifecycle_state as ReleaseLifecycleState,
      builtAt: row.built_at.toISOString(),
      ...(row.sealed_at === null ? {} : { sealedAt: row.sealed_at.toISOString() }),
      ...(row.content_sha256 === null ? {} : { contentSha256: row.content_sha256 }),
    };
  }
}
