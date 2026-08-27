import { sql, type Kysely } from "kysely";
import type { Database } from "../../../platform/database/database.types.js";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  PublicEvidenceSummary,
  PublicLifeEventSummary,
  PublicLineageSummary,
  PublicMediaSummary,
  PublicPandaDetail,
  PublicPandaSummary,
  PublicPlaceSummary,
  PublicReadPort,
  PublicReadRelease,
  PublicReadResult,
  PublicResidencySummary,
  PublicStats,
} from "../application/public-read.application.js";

interface DeliveryControls {
  panda: Set<string>;
  place: Set<string>;
  media: Set<string>;
  evidence: Set<string>;
}

export class PostgresPublicReadRepository implements PublicReadPort {
  public constructor(private readonly database: DatabaseService) {}

  public async currentRelease(): Promise<PublicReadResult<PublicReadRelease>> {
    const release = await this.resolveCurrentRelease(this.database.db);
    return release === undefined ? { kind: "unavailable" } : { kind: "ok", value: release };
  }

  public async listPandas(): Promise<
    PublicReadResult<{ release: PublicReadRelease; items: PublicPandaSummary[] }>
  > {
    const release = await this.resolveCurrentRelease(this.database.db);
    if (release === undefined) return { kind: "unavailable" };
    const controls = await this.loadDeliveryControls(this.database.db);
    const rows = await this.database.db
      .selectFrom("public_read.pandas")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .orderBy("canonical_slug")
      .execute();
    return {
      kind: "ok",
      value: {
        release,
        items: rows.filter((row) => !controls.panda.has(row.panda_id)).map((row) => this.mapPanda(row)),
      },
    };
  }

  public async getPanda(slug: string): Promise<PublicReadResult<PublicPandaDetail>> {
    const release = await this.resolveCurrentRelease(this.database.db);
    if (release === undefined) return { kind: "unavailable" };
    const controls = await this.loadDeliveryControls(this.database.db);
    const pandaRow = await this.database.db
      .selectFrom("public_read.pandas")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where((expression) =>
        expression.or([
          expression("canonical_slug", "=", slug),
          sql<boolean>`${slug} = any(legacy_slugs)`,
        ]),
      )
      .executeTakeFirst();
    if (pandaRow === undefined || controls.panda.has(pandaRow.panda_id)) return { kind: "not_found" };

    const lineageRows = await this.database.db
      .selectFrom("public_read.lineage")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where((expression) =>
        expression.or([
          expression("child_id", "=", pandaRow.panda_id),
          expression("parent_id", "=", pandaRow.panda_id),
        ]),
      )
      .orderBy("assertion_id")
      .execute();
    const lineage = lineageRows
      .filter((row) => !controls.panda.has(row.child_id) && !controls.panda.has(row.parent_id))
      .map((row) => this.mapLineage(row));

    const residencyRows = await this.database.db
      .selectFrom("public_read.residencies")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where("panda_id", "=", pandaRow.panda_id)
      .orderBy("start_on", "desc")
      .orderBy("residency_id")
      .execute();
    const residencies = residencyRows
      .filter((row) => !controls.place.has(row.place_id))
      .map((row) => this.mapResidency(row));

    const eventRows = await this.database.db
      .selectFrom("public_read.life_events")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where(sql<boolean>`${pandaRow.panda_id}::uuid = any(participant_ids)`)
      .orderBy("occurred_on", "desc")
      .orderBy("event_id")
      .execute();
    const events = eventRows
      .filter(
        (row) =>
          !row.participant_ids.some((pandaId) => controls.panda.has(pandaId)) &&
          (row.from_place_id === null || !controls.place.has(row.from_place_id)) &&
          (row.to_place_id === null || !controls.place.has(row.to_place_id)),
      )
      .map((row) => this.mapEvent(row));

    const mediaRows = await this.database.db
      .selectFrom("public_read.media")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where("panda_id", "=", pandaRow.panda_id)
      .orderBy("display_order")
      .orderBy("asset_id")
      .execute();
    const media = mediaRows
      .filter((row) => !controls.media.has(row.asset_id))
      .map((row) => this.mapMedia(row));

    const evidenceIds = new Set<string>(pandaRow.evidence_source_ids);
    for (const item of lineage) for (const sourceId of item.sourceIds) evidenceIds.add(sourceId);
    for (const item of residencies) for (const sourceId of item.sourceIds) evidenceIds.add(sourceId);
    for (const item of events) for (const sourceId of item.sourceIds) evidenceIds.add(sourceId);
    for (const item of media) if (item.sourceId !== undefined) evidenceIds.add(item.sourceId);
    const deliverableEvidenceIds = [...evidenceIds].filter((sourceId) => !controls.evidence.has(sourceId));
    const evidenceRows =
      deliverableEvidenceIds.length === 0
        ? []
        : await this.database.db
            .selectFrom("public_read.evidence_sources")
            .selectAll()
            .where("release_id", "=", release.releaseId)
            .where("source_id", "in", deliverableEvidenceIds)
            .orderBy("source_id")
            .execute();

    return {
      kind: "ok",
      value: {
        release,
        panda: this.mapPanda(pandaRow),
        lineage,
        residencies,
        events,
        media,
        evidence: evidenceRows.map((row) => this.mapEvidence(row)),
      },
    };
  }

  public async listPlaces(): Promise<
    PublicReadResult<{ release: PublicReadRelease; items: PublicPlaceSummary[] }>
  > {
    const release = await this.resolveCurrentRelease(this.database.db);
    if (release === undefined) return { kind: "unavailable" };
    const controls = await this.loadDeliveryControls(this.database.db);
    const rows = await this.database.db
      .selectFrom("public_read.places")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .orderBy("slug")
      .execute();
    return {
      kind: "ok",
      value: {
        release,
        items: rows.filter((row) => !controls.place.has(row.place_id)).map((row) => this.mapPlace(row)),
      },
    };
  }

  public async getPlace(
    slug: string,
  ): Promise<PublicReadResult<{ release: PublicReadRelease; place: PublicPlaceSummary }>> {
    const release = await this.resolveCurrentRelease(this.database.db);
    if (release === undefined) return { kind: "unavailable" };
    const controls = await this.loadDeliveryControls(this.database.db);
    const row = await this.database.db
      .selectFrom("public_read.places")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where("slug", "=", slug)
      .executeTakeFirst();
    if (row === undefined || controls.place.has(row.place_id)) return { kind: "not_found" };
    return { kind: "ok", value: { release, place: this.mapPlace(row) } };
  }

  public async getEvidence(
    sourceId: string,
  ): Promise<PublicReadResult<{ release: PublicReadRelease; source: PublicEvidenceSummary }>> {
    const release = await this.resolveCurrentRelease(this.database.db);
    if (release === undefined) return { kind: "unavailable" };
    const controls = await this.loadDeliveryControls(this.database.db);
    if (controls.evidence.has(sourceId)) return { kind: "not_found" };
    const row = await this.database.db
      .selectFrom("public_read.evidence_sources")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where("source_id", "=", sourceId)
      .executeTakeFirst();
    return row === undefined
      ? { kind: "not_found" }
      : { kind: "ok", value: { release, source: this.mapEvidence(row) } };
  }

  public async stats(): Promise<PublicReadResult<{ release: PublicReadRelease; stats: PublicStats }>> {
    const release = await this.resolveCurrentRelease(this.database.db);
    if (release === undefined) return { kind: "unavailable" };
    const row = await this.database.db
      .selectFrom("public_read.stats")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .executeTakeFirst();
    if (row === undefined) return { kind: "not_found" };
    return {
      kind: "ok",
      value: {
        release,
        stats: {
          pandaCount: row.panda_count,
          institutionCount: row.institution_count,
          placeCount: row.place_count,
          lineageCount: row.lineage_count,
          residencyCount: row.residency_count,
          lifeEventCount: row.life_event_count,
          mediaCount: row.media_count,
          evidenceSourceCount: row.evidence_source_count,
        },
      },
    };
  }

  private async resolveCurrentRelease(db: Kysely<Database>): Promise<PublicReadRelease | undefined> {
    const row = await db
      .selectFrom("publication.current_release as current")
      .innerJoin("publication.releases as release", "release.release_id", "current.release_id")
      .select(["release.release_id", "release.version", "release.lifecycle_state"])
      .where("current.singleton", "=", true)
      .executeTakeFirst();
    if (row === undefined || row.lifecycle_state !== "sealed") return undefined;
    const suspension = await db
      .selectFrom("publication.delivery_control_events")
      .select("action")
      .where("control_kind", "=", "release_suspension")
      .where("release_id", "=", row.release_id)
      .orderBy("occurred_at", "desc")
      .orderBy("control_event_id", "desc")
      .executeTakeFirst();
    return suspension?.action === "apply" ? undefined : { releaseId: row.release_id, version: row.version };
  }

  private async loadDeliveryControls(db: Kysely<Database>): Promise<DeliveryControls> {
    const rows = await db
      .selectFrom("publication.delivery_control_events")
      .select(["resource_kind", "resource_id", "action"])
      .where("control_kind", "=", "resource_takedown")
      .orderBy("occurred_at", "desc")
      .orderBy("control_event_id", "desc")
      .execute();
    const seen = new Set<string>();
    const controls: DeliveryControls = {
      panda: new Set(),
      place: new Set(),
      media: new Set(),
      evidence: new Set(),
    };
    for (const row of rows) {
      if (row.resource_kind === null || row.resource_id === null) continue;
      const key = `${row.resource_kind}:${row.resource_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (row.action === "apply" && row.resource_kind in controls) {
        controls[row.resource_kind as keyof DeliveryControls].add(row.resource_id);
      }
    }
    return controls;
  }

  private mapPanda(row: {
    panda_id: string;
    canonical_slug: string;
    legacy_slugs: string[];
    names: unknown;
    facts: unknown;
  }): PublicPandaSummary {
    return {
      pandaId: row.panda_id,
      canonicalSlug: row.canonical_slug,
      legacySlugs: row.legacy_slugs,
      names: row.names as PublicPandaSummary["names"],
      facts: row.facts as PublicPandaSummary["facts"],
    };
  }

  private mapPlace(row: {
    place_id: string;
    institution_id: string | null;
    slug: string;
    place_type: string;
    name_zh: string | null;
    name_en: string | null;
    country_code: string | null;
    region: string | null;
    longitude: number | null;
    latitude: number | null;
  }): PublicPlaceSummary {
    return {
      placeId: row.place_id,
      ...(row.institution_id === null ? {} : { institutionId: row.institution_id }),
      slug: row.slug,
      placeType: row.place_type,
      ...(row.name_zh === null ? {} : { nameZh: row.name_zh }),
      ...(row.name_en === null ? {} : { nameEn: row.name_en }),
      ...(row.country_code === null ? {} : { countryCode: row.country_code }),
      ...(row.region === null ? {} : { region: row.region }),
      ...(row.longitude === null ? {} : { longitude: row.longitude }),
      ...(row.latitude === null ? {} : { latitude: row.latitude }),
    };
  }

  private mapEvidence(row: {
    source_id: string;
    publisher: string;
    title: string;
    url: string;
    published_on: string | null;
    last_verified_on: string;
    language_tag: string;
    access_state: string;
    evidence_tier: string | null;
    public_summary: string | null;
  }): PublicEvidenceSummary {
    return {
      sourceId: row.source_id,
      publisher: row.publisher,
      title: row.title,
      url: row.url,
      ...(row.published_on === null ? {} : { publishedOn: row.published_on }),
      lastVerifiedOn: row.last_verified_on,
      languageTag: row.language_tag,
      accessState: row.access_state,
      ...(row.evidence_tier === null ? {} : { evidenceTier: row.evidence_tier }),
      ...(row.public_summary === null ? {} : { publicSummary: row.public_summary }),
    };
  }

  private mapMedia(row: {
    asset_id: string;
    panda_id: string;
    source_id: string | null;
    usage_role: string;
    display_order: number;
    object_key: string;
    content_sha256: string;
    media_type: string;
    title: string | null;
    creator: string | null;
    copyright_text: string | null;
    license: string | null;
    attribution_text: string | null;
    taken_at: Date | null;
  }): PublicMediaSummary {
    return {
      assetId: row.asset_id,
      pandaId: row.panda_id,
      ...(row.source_id === null ? {} : { sourceId: row.source_id }),
      usageRole: row.usage_role,
      displayOrder: row.display_order,
      objectKey: row.object_key,
      contentSha256: row.content_sha256,
      mediaType: row.media_type,
      ...(row.title === null ? {} : { title: row.title }),
      ...(row.creator === null ? {} : { creator: row.creator }),
      ...(row.copyright_text === null ? {} : { copyrightText: row.copyright_text }),
      ...(row.license === null ? {} : { license: row.license }),
      ...(row.attribution_text === null ? {} : { attributionText: row.attribution_text }),
      ...(row.taken_at === null ? {} : { takenAt: row.taken_at.toISOString() }),
    };
  }

  private mapLineage(row: {
    assertion_id: string;
    child_id: string;
    parent_id: string;
    parent_role: string;
    source_ids: string[];
  }): PublicLineageSummary {
    return {
      assertionId: row.assertion_id,
      childId: row.child_id,
      parentId: row.parent_id,
      parentRole: row.parent_role,
      sourceIds: row.source_ids,
    };
  }

  private mapResidency(row: {
    residency_id: string;
    panda_id: string;
    place_id: string;
    residency_type: string;
    start_on: string | null;
    start_precision: string;
    end_on: string | null;
    end_precision: string | null;
    status: string;
    source_ids: string[];
  }): PublicResidencySummary {
    return {
      residencyId: row.residency_id,
      pandaId: row.panda_id,
      placeId: row.place_id,
      residencyType: row.residency_type,
      ...(row.start_on === null ? {} : { startOn: row.start_on }),
      startPrecision: row.start_precision,
      ...(row.end_on === null ? {} : { endOn: row.end_on }),
      ...(row.end_precision === null ? {} : { endPrecision: row.end_precision }),
      status: row.status,
      sourceIds: row.source_ids,
    };
  }

  private mapEvent(row: {
    event_id: string;
    event_type: string;
    event_status: string;
    occurred_on: string | null;
    occurred_precision: string;
    from_place_id: string | null;
    to_place_id: string | null;
    summary: string | null;
    participant_ids: string[];
    source_ids: string[];
  }): PublicLifeEventSummary {
    return {
      eventId: row.event_id,
      eventType: row.event_type,
      eventStatus: row.event_status,
      ...(row.occurred_on === null ? {} : { occurredOn: row.occurred_on }),
      occurredPrecision: row.occurred_precision,
      ...(row.from_place_id === null ? {} : { fromPlaceId: row.from_place_id }),
      ...(row.to_place_id === null ? {} : { toPlaceId: row.to_place_id }),
      ...(row.summary === null ? {} : { summary: row.summary }),
      participantIds: row.participant_ids,
      sourceIds: row.source_ids,
    };
  }
}
