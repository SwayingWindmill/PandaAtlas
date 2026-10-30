import { sql, type Kysely } from "kysely";
import type { Database } from "../../../platform/database/database.types.js";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  PublicEvidenceSummary,
  PublicLifeEventSummary,
  PublicLineageSummary,
  PublicMediaSummary,
  PublicPandaDetail,
  PublicInstitutionDetail,
  PublicInstitutionSummary,
  PublicPandaSummary,
  PublicPlaceSummary,
  PublicReadPort,
  PublicReadRelease,
  PublicReadResult,
  PublicResidencySummary,
  PublicStats,
} from "../application/public-read.application.js";
import { familyCircleIds } from "../application/family-circle.js";
import type { FacilityVisitGuide, InstitutionProfile } from "../../places/application/visitor-content.js";
import type { PublicReadCache } from "./public-read-cache.js";

// listing_facts is the stored projection of LISTING_FACT_KEYS. Reading it avoids detoasting facts.
const listingPandaColumns = [
  "panda_id",
  "canonical_slug",
  "legacy_slugs",
  "names",
  "listing_facts",
] as const;

interface DeliveryControls {
  panda: Set<string>;
  place: Set<string>;
  media: Set<string>;
  evidence: Set<string>;
}

interface PublicSnapshot {
  release: PublicReadRelease;
  controls: DeliveryControls;
}

interface PublicReadLineageRow {
  assertion_id: string;
  child_id: string;
  parent_id: string;
  parent_role: string;
  source_ids: string[];
}

export class PostgresPublicReadRepository implements PublicReadPort {
  public constructor(
    private readonly database: DatabaseService,
    private readonly cache: PublicReadCache,
  ) {}

  public async currentRelease(): Promise<PublicReadResult<PublicReadRelease>> {
    const snapshot = await this.snapshot();
    return snapshot === undefined ? { kind: "unavailable" } : { kind: "ok", value: snapshot.release };
  }

  public async listPandas(): Promise<
    PublicReadResult<{ release: PublicReadRelease; items: PublicPandaSummary[] }>
  > {
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
    const rows = await this.database.db
      .selectFrom("public_read.pandas")
      .select(listingPandaColumns)
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

  public async listPandaCovers(
    pandaIds: readonly string[],
  ): Promise<PublicReadResult<{ release: PublicReadRelease; items: PublicMediaSummary[] }>> {
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
    const rows = await this.database.db
      .selectFrom("public_read.media")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where("panda_id", "in", [...pandaIds])
      .where("media_type", "like", "image/%")
      .orderBy("panda_id")
      .orderBy("display_order")
      .orderBy("asset_id")
      .execute();
    const covers = new Map<string, PublicMediaSummary>();
    for (const row of rows) {
      if (covers.has(row.panda_id) || controls.panda.has(row.panda_id) || controls.media.has(row.asset_id)) continue;
      covers.set(row.panda_id, this.mapMedia(row));
    }
    return { kind: "ok", value: { release, items: [...covers.values()] } };
  }

  public async getPanda(slug: string): Promise<PublicReadResult<PublicPandaDetail>> {
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
    const pandaRow = await this.database.db
      .selectFrom("public_read.pandas")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where((expression) =>
        expression.or([
          expression("canonical_slug", "=", slug),
          sql<boolean>`${slug} = any(legacy_slugs)`,
          sql<boolean>`panda_id::text = ${slug}`,
        ]),
      )
      .executeTakeFirst();
    if (pandaRow === undefined || controls.panda.has(pandaRow.panda_id)) return { kind: "not_found" };

    const familyRows = await this.loadFamilyLineage(release.releaseId, pandaRow.panda_id);
    const deliverableFamily = familyRows.filter(
      (row) => !controls.panda.has(row.parent_id) && !controls.panda.has(row.child_id),
    );
    const relativeIds = familyCircleIds(
      pandaRow.panda_id,
      deliverableFamily.map((row) => ({ parentId: row.parent_id, childId: row.child_id })),
    );
    const relativeRows =
      relativeIds.length === 0
        ? []
        : await this.database.db
            .selectFrom("public_read.pandas")
            .select(listingPandaColumns)
            .where("release_id", "=", release.releaseId)
            .where("panda_id", "in", relativeIds)
            .orderBy("canonical_slug")
            .execute();

    const lineage = deliverableFamily
      .filter((row) => row.child_id === pandaRow.panda_id || row.parent_id === pandaRow.panda_id)
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
        relatives: relativeRows.map((row) => this.mapPanda(row)),
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
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
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
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
    const row = await this.database.db
      .selectFrom("public_read.places")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      // A merged duplicate's slug still finds the place it was merged into.
      .where((eb) => eb.or([eb("slug", "=", slug), sql<boolean>`${slug} = any(legacy_slugs)`]))
      .orderBy(sql`slug = ${slug}`, "desc")
      .executeTakeFirst();
    if (row === undefined || controls.place.has(row.place_id)) return { kind: "not_found" };
    return { kind: "ok", value: { release, place: this.mapPlace(row) } };
  }

  public async listInstitutions(): Promise<
    PublicReadResult<{ release: PublicReadRelease; items: PublicInstitutionSummary[] }>
  > {
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release } = snapshot;
    const rows = await this.database.db
      .selectFrom("public_read.institutions")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .orderBy("slug")
      .execute();
    return { kind: "ok", value: { release, items: rows.map((row) => this.mapInstitution(row)) } };
  }

  public async getInstitution(slug: string): Promise<PublicReadResult<PublicInstitutionDetail>> {
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
    const row = await this.database.db
      .selectFrom("public_read.institutions")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where("slug", "=", slug)
      .executeTakeFirst();
    if (row === undefined) return { kind: "not_found" };
    const placeRows = await this.database.db
      .selectFrom("public_read.places")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .where("institution_id", "=", row.institution_id)
      .orderBy("slug")
      .execute();
    return {
      kind: "ok",
      value: {
        release,
        institution: this.mapInstitution(row),
        places: placeRows.filter((place) => !controls.place.has(place.place_id)).map((place) => this.mapPlace(place)),
      },
    };
  }

  public async listLineage(): Promise<
    PublicReadResult<{ release: PublicReadRelease; items: PublicLineageSummary[] }>
  > {
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
    const rows = await this.database.db
      .selectFrom("public_read.lineage")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .orderBy("assertion_id")
      .execute();
    return {
      kind: "ok",
      value: {
        release,
        items: rows
          .filter((row) => !controls.panda.has(row.child_id) && !controls.panda.has(row.parent_id))
          .map((row) => this.mapLineage(row)),
      },
    };
  }

  public async listResidencies(): Promise<
    PublicReadResult<{ release: PublicReadRelease; items: PublicResidencySummary[] }>
  > {
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
    const rows = await this.database.db
      .selectFrom("public_read.residencies")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .orderBy("panda_id")
      .orderBy("start_on", "desc")
      .orderBy("residency_id")
      .execute();
    return {
      kind: "ok",
      value: {
        release,
        items: rows
          .filter((row) => !controls.panda.has(row.panda_id) && !controls.place.has(row.place_id))
          .map((row) => this.mapResidency(row)),
      },
    };
  }

  public async listLifeEvents(): Promise<
    PublicReadResult<{ release: PublicReadRelease; items: PublicLifeEventSummary[] }>
  > {
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
    const rows = await this.database.db
      .selectFrom("public_read.life_events")
      .selectAll()
      .where("release_id", "=", release.releaseId)
      .orderBy("occurred_on", "desc")
      .orderBy("event_id")
      .execute();
    return {
      kind: "ok",
      value: {
        release,
        items: rows
          .filter(
            (row) =>
              !row.participant_ids.some((pandaId) => controls.panda.has(pandaId)) &&
              (row.from_place_id === null || !controls.place.has(row.from_place_id)) &&
              (row.to_place_id === null || !controls.place.has(row.to_place_id)),
          )
          .map((row) => this.mapEvent(row)),
      },
    };
  }

  public async getEvidence(
    sourceId: string,
  ): Promise<PublicReadResult<{ release: PublicReadRelease; source: PublicEvidenceSummary }>> {
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release, controls } = snapshot;
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
    const snapshot = await this.snapshot();
    if (snapshot === undefined) return { kind: "unavailable" };
    const { release } = snapshot;
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

  // Release pointer, suspension and takedowns are one cached snapshot. Every list
  // and detail read in this generation reuses it instead of repeating those queries.
  private snapshot(): Promise<PublicSnapshot | undefined> {
    return this.cache.remember(
      "snapshot",
      () => this.loadReleaseAndControls(this.database.db),
      (snapshot) => snapshot !== undefined,
    );
  }

  // Parents, children, siblings and grandparents. One neighborhood read replaces
  // loading every lineage row and then reading the focus panda's edges again.
  private async loadFamilyLineage(releaseId: string, pandaId: string): Promise<PublicReadLineageRow[]> {
    const result = await sql<PublicReadLineageRow>`
      select assertion_id, child_id, parent_id, parent_role, source_ids
      from (
        select assertion_id, child_id, parent_id, parent_role, source_ids
        from public_read.lineage
        where release_id = ${releaseId} and (child_id = ${pandaId} or parent_id = ${pandaId})
        union
        select sib.assertion_id, sib.child_id, sib.parent_id, sib.parent_role, sib.source_ids
        from public_read.lineage as me
        join public_read.lineage as sib
          on sib.release_id = me.release_id and sib.parent_id = me.parent_id
        where me.release_id = ${releaseId} and me.child_id = ${pandaId}
        union
        select gp.assertion_id, gp.child_id, gp.parent_id, gp.parent_role, gp.source_ids
        from public_read.lineage as me
        join public_read.lineage as gp
          on gp.release_id = me.release_id and gp.child_id = me.parent_id
        where me.release_id = ${releaseId} and me.child_id = ${pandaId}
      ) as family
      order by assertion_id
    `.execute(this.database.db);
    const seen = new Set<string>();
    return result.rows.filter((row) => {
      if (seen.has(row.assertion_id)) return false;
      seen.add(row.assertion_id);
      return true;
    });
  }

  // One round trip for suspension and takedowns. Delivery controls are empty in steady
  // state, and the snapshot cache keeps later requests in this generation off this query.
  private async loadReleaseAndControls(db: Kysely<Database>): Promise<PublicSnapshot | undefined> {
    const row = await db
      .selectFrom("publication.current_release as current")
      .innerJoin("publication.releases as release", "release.release_id", "current.release_id")
      .select(["release.release_id", "release.version", "release.lifecycle_state"])
      .where("current.singleton", "=", true)
      .executeTakeFirst();
    if (row === undefined || row.lifecycle_state !== "sealed") return undefined;

    const events = await db
      .selectFrom("publication.delivery_control_events")
      .select(["control_kind", "resource_kind", "resource_id", "action"])
      .where((expression) =>
        expression.or([
          expression.and([
            expression("control_kind", "=", "release_suspension"),
            expression("release_id", "=", row.release_id),
          ]),
          expression("control_kind", "=", "resource_takedown"),
        ]),
      )
      .orderBy("occurred_at", "desc")
      .orderBy("control_event_id", "desc")
      .execute();

    const controls: DeliveryControls = {
      panda: new Set(),
      place: new Set(),
      media: new Set(),
      evidence: new Set(),
    };
    const seen = new Set<string>();
    let suspended = false;
    let sawSuspension = false;
    for (const event of events) {
      if (event.control_kind === "release_suspension") {
        if (!sawSuspension) {
          sawSuspension = true;
          suspended = event.action === "apply";
        }
        continue;
      }
      if (event.resource_kind === null || event.resource_id === null) continue;
      const key = `${event.resource_kind}:${event.resource_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (event.action === "apply" && event.resource_kind in controls) {
        controls[event.resource_kind as keyof DeliveryControls].add(event.resource_id);
      }
    }
    if (suspended) return undefined;
    return { release: { releaseId: row.release_id, version: row.version }, controls };
  }

  private mapPanda(row: {
    panda_id: string;
    canonical_slug: string;
    legacy_slugs: string[];
    names: unknown;
    facts?: unknown;
    listing_facts?: unknown;
  }): PublicPandaSummary {
    return {
      pandaId: row.panda_id,
      canonicalSlug: row.canonical_slug,
      legacySlugs: row.legacy_slugs,
      names: row.names as PublicPandaSummary["names"],
      // Detail reads select every fact. Lists and relatives select listing_facts only.
      facts: (row.facts ?? row.listing_facts) as PublicPandaSummary["facts"],
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
    visit_guide: unknown;
    legacy_slugs: string[];
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
      ...(row.visit_guide === null ? {} : { visitGuide: row.visit_guide as FacilityVisitGuide }),
      ...(row.legacy_slugs.length === 0 ? {} : { legacySlugs: row.legacy_slugs }),
    };
  }

  private mapInstitution(row: {
    institution_id: string;
    slug: string;
    name_zh: string | null;
    name_en: string | null;
    country_code: string | null;
    profile: unknown;
  }): PublicInstitutionSummary {
    return {
      institutionId: row.institution_id,
      slug: row.slug,
      ...(row.name_zh === null ? {} : { nameZh: row.name_zh }),
      ...(row.name_en === null ? {} : { nameEn: row.name_en }),
      ...(row.country_code === null ? {} : { countryCode: row.country_code }),
      ...(row.profile === null ? {} : { profile: row.profile as InstitutionProfile }),
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
