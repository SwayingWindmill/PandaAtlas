import { sql } from "kysely";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  CreateInstitutionInput,
  CreatePlaceInput,
  InstitutionRecord,
  PlaceRecord,
  PlacesRepository,
  PlaceType,
} from "../application/places.application.js";

interface PlaceRow {
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
}

export class PostgresPlacesRepository implements PlacesRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async createInstitution(input: CreateInstitutionInput): Promise<InstitutionRecord> {
    const row = await this.database.db
      .insertInto("place.institutions")
      .values({
        slug: input.slug,
        name_zh: input.nameZh,
        name_en: input.nameEn,
        country_code: input.countryCode,
      })
      .returning(["institution_id", "slug", "name_zh", "name_en", "country_code"])
      .executeTakeFirstOrThrow();
    return this.mapInstitution(row);
  }

  public async replaceInstitution(
    institutionId: string,
    input: CreateInstitutionInput,
  ): Promise<InstitutionRecord> {
    const row = await this.database.db
      .updateTable("place.institutions")
      .set({
        slug: input.slug,
        name_zh: input.nameZh ?? null,
        name_en: input.nameEn ?? null,
        country_code: input.countryCode ?? null,
        updated_at: new Date(),
      })
      .where("institution_id", "=", institutionId)
      .returning(["institution_id", "slug", "name_zh", "name_en", "country_code"])
      .executeTakeFirstOrThrow();
    return this.mapInstitution(row);
  }

  public async createPlace(input: CreatePlaceInput): Promise<PlaceRecord> {
    const row = await this.database.db
      .insertInto("place.places")
      .values({
        institution_id: input.institutionId,
        slug: input.slug,
        place_type: input.placeType,
        name_zh: input.nameZh,
        name_en: input.nameEn,
        country_code: input.countryCode,
        region: input.region,
        center:
          input.center === undefined
            ? undefined
            : sql`ST_SetSRID(ST_MakePoint(${input.center.longitude}, ${input.center.latitude}), 4326)`,
      })
      .returning("place_id")
      .executeTakeFirstOrThrow();
    const created = await this.getPlace(row.place_id);
    if (created === undefined) {
      throw new Error("Created place could not be reloaded");
    }
    return created;
  }

  public async replacePlace(placeId: string, input: CreatePlaceInput): Promise<PlaceRecord> {
    await this.database.db
      .updateTable("place.places")
      .set({
        institution_id: input.institutionId ?? null,
        slug: input.slug,
        place_type: input.placeType,
        name_zh: input.nameZh ?? null,
        name_en: input.nameEn ?? null,
        country_code: input.countryCode ?? null,
        region: input.region ?? null,
        center:
          input.center === undefined
            ? null
            : sql`ST_SetSRID(ST_MakePoint(${input.center.longitude}, ${input.center.latitude}), 4326)`,
        updated_at: new Date(),
      })
      .where("place_id", "=", placeId)
      .returning("place_id")
      .executeTakeFirstOrThrow();
    const updated = await this.getPlace(placeId);
    if (updated === undefined) {
      throw new Error("Updated place could not be reloaded");
    }
    return updated;
  }

  public async getPlace(placeId: string): Promise<PlaceRecord | undefined> {
    const result = await sql<PlaceRow>`
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
        case when center is null then null else ST_Y(center) end as latitude
      from place.places
      where place_id = ${placeId}::uuid
    `.execute(this.database.db);
    const row = result.rows[0];
    if (row === undefined) {
      return undefined;
    }
    return {
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
        : { center: { longitude: row.longitude, latitude: row.latitude } }),
    };
  }

  public async placeExists(placeId: string): Promise<boolean> {
    const row = await this.database.db
      .selectFrom("place.places")
      .select("place_id")
      .where("place_id", "=", placeId)
      .executeTakeFirst();
    return row !== undefined;
  }

  private mapInstitution(row: {
    institution_id: string;
    slug: string;
    name_zh: string | null;
    name_en: string | null;
    country_code: string | null;
  }): InstitutionRecord {
    return {
      institutionId: row.institution_id,
      slug: row.slug,
      ...(row.name_zh === null ? {} : { nameZh: row.name_zh }),
      ...(row.name_en === null ? {} : { nameEn: row.name_en }),
      ...(row.country_code === null ? {} : { countryCode: row.country_code }),
    };
  }
}
