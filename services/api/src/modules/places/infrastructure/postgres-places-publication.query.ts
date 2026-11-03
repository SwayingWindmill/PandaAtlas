import { sql } from "kysely";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import { sha256Content } from "../../../platform/integrity/content-digest.js";
import type {
  InstitutionPublicationSource,
  PlacePublicationSource,
  PlacesPublicationPort,
  PlacesPublicationSnapshot,
} from "../application/places-publication.application.js";
import type { PlaceType } from "../application/places.application.js";
import type { FacilityVisitGuide, InstitutionProfile } from "../application/visitor-content.js";

interface PlacePublicationRow {
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
  visit_guide: FacilityVisitGuide | null;
  legacy_slugs: string[];
  updated_at: Date;
}

export class PostgresPlacesPublicationQuery implements PlacesPublicationPort {
  public async snapshot(transaction: DatabaseTransaction): Promise<PlacesPublicationSnapshot> {
    const institutionRows = await transaction
      .selectFrom("place.institutions")
      .select(["institution_id", "slug", "name_zh", "name_en", "country_code", "profile", "updated_at"])
      .orderBy("institution_id")
      .execute();

    const placeRows = await sql<PlacePublicationRow>`
      select
        place_id,
        institution_id,
        slug,
        place_type,
        name_zh,
        name_en,
        country_code,
        region,
        case when center is null then null else ST_X(center) end as longitude,
        case when center is null then null else ST_Y(center) end as latitude,
        visit_guide,
        legacy_slugs,
        updated_at
      from place.places
      order by place_id
    `.execute(transaction);

    const institutions: InstitutionPublicationSource[] = institutionRows.map((row) => {
      const projection = {
        institutionId: row.institution_id,
        slug: row.slug,
        ...(row.name_zh === null ? {} : { nameZh: row.name_zh }),
        ...(row.name_en === null ? {} : { nameEn: row.name_en }),
        ...(row.country_code === null ? {} : { countryCode: row.country_code }),
        // Absent keys keep the digest of institutions without a profile unchanged.
        ...(row.profile === null ? {} : { profile: row.profile as unknown as InstitutionProfile }),
      };
      const revision = row.updated_at.toISOString();
      return {
        ...projection,
        sourceRevision: revision,
        sourceVersion: revision,
        sourceSha256: sha256Content(projection),
      };
    });

    const places: PlacePublicationSource[] = placeRows.rows.map((row) => {
      const projection = {
        placeId: row.place_id,
        ...(row.institution_id === null ? {} : { institutionId: row.institution_id }),
        slug: row.slug,
        placeType: row.place_type as PlaceType,
        ...(row.name_zh === null ? {} : { nameZh: row.name_zh }),
        ...(row.name_en === null ? {} : { nameEn: row.name_en }),
        ...(row.country_code === null ? {} : { countryCode: row.country_code }),
        ...(row.region === null ? {} : { region: row.region }),
        ...(row.longitude === null || row.latitude === null
          ? {}
          : { longitude: row.longitude, latitude: row.latitude }),
        ...(row.visit_guide === null ? {} : { visitGuide: row.visit_guide }),
        // Only merged places carry the key, so every other place keeps its digest.
        ...(row.legacy_slugs.length === 0 ? {} : { legacySlugs: row.legacy_slugs }),
      };
      const revision = row.updated_at.toISOString();
      return {
        ...projection,
        sourceRevision: revision,
        sourceVersion: revision,
        sourceSha256: sha256Content(projection),
      };
    });

    return { institutions, places };
  }
}
