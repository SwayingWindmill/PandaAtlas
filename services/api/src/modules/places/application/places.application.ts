export type PlaceType = "facility" | "habitat" | "protected_area" | "distribution_area" | "coarse_location";

export interface InstitutionRecord {
  institutionId: string;
  slug: string;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
}

export interface PlaceRecord {
  placeId: string;
  institutionId?: string;
  slug: string;
  placeType: PlaceType;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
  region?: string;
  center?: { longitude: number; latitude: number };
}

export interface CreateInstitutionInput {
  slug: string;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
}

export interface CreatePlaceInput {
  institutionId?: string;
  slug: string;
  placeType: PlaceType;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
  region?: string;
  center?: { longitude: number; latitude: number };
}

export interface PlacesRepository {
  createInstitution(input: CreateInstitutionInput): Promise<InstitutionRecord>;
  replaceInstitution(institutionId: string, input: CreateInstitutionInput): Promise<InstitutionRecord>;
  createPlace(input: CreatePlaceInput): Promise<PlaceRecord>;
  replacePlace(placeId: string, input: CreatePlaceInput): Promise<PlaceRecord>;
  getPlace(placeId: string): Promise<PlaceRecord | undefined>;
  placeExists(placeId: string): Promise<boolean>;
}

export type PlacesPort = PlacesRepository;
export interface PlaceReferencePort {
  exists(placeId: string): Promise<boolean>;
}

export const PLACES_REPOSITORY = Symbol("PLACES_REPOSITORY");
export const PLACES_PORT = Symbol("PLACES_PORT");
export const PLACE_REFERENCE_PORT = Symbol("PLACE_REFERENCE_PORT");

export class PlacesApplication implements PlacesPort, PlaceReferencePort {
  public constructor(private readonly repository: PlacesRepository) {}

  public createInstitution(input: CreateInstitutionInput): Promise<InstitutionRecord> {
    return this.repository.createInstitution(input);
  }

  public replaceInstitution(institutionId: string, input: CreateInstitutionInput): Promise<InstitutionRecord> {
    return this.repository.replaceInstitution(institutionId, input);
  }

  public createPlace(input: CreatePlaceInput): Promise<PlaceRecord> {
    this.assertInstitutionBoundary(input);
    return this.repository.createPlace(input);
  }

  public replacePlace(placeId: string, input: CreatePlaceInput): Promise<PlaceRecord> {
    this.assertInstitutionBoundary(input);
    return this.repository.replacePlace(placeId, input);
  }

  public getPlace(placeId: string): Promise<PlaceRecord | undefined> {
    return this.repository.getPlace(placeId);
  }

  public placeExists(placeId: string): Promise<boolean> {
    return this.repository.placeExists(placeId);
  }

  public exists(placeId: string): Promise<boolean> {
    return this.repository.placeExists(placeId);
  }

  private assertInstitutionBoundary(input: CreatePlaceInput): void {
    if (input.placeType !== "facility" && input.institutionId !== undefined) {
      throw new Error("Only facility places may belong to an institution");
    }
  }
}
