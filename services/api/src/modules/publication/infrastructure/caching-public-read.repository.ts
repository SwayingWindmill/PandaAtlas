import type {
  PublicReadPort,
  PublicReadResult,
} from "../application/public-read.application.js";
import type { PublicReadCache } from "./public-read-cache.js";

// The Postgres repository still hits the database on a cold generation. Repeating
// the same read while that generation is current is free.
export class CachingPublicReadRepository implements PublicReadPort {
  public constructor(
    private readonly inner: PublicReadPort,
    private readonly cache: PublicReadCache,
  ) {}

  public currentRelease() {
    return this.remember("currentRelease", () => this.inner.currentRelease());
  }

  public listPandas() {
    return this.remember("listPandas", () => this.inner.listPandas());
  }

  public getPanda(slug: string) {
    return this.remember(`panda:${slug}`, () => this.inner.getPanda(slug));
  }

  public listPandaCovers(pandaIds: readonly string[]) {
    const key = [...pandaIds].sort().join(",");
    return this.remember(`covers:${key}`, () => this.inner.listPandaCovers(pandaIds));
  }

  public listPlaces() {
    return this.remember("listPlaces", () => this.inner.listPlaces());
  }

  public getPlace(slug: string) {
    return this.remember(`place:${slug}`, () => this.inner.getPlace(slug));
  }

  public listInstitutions() {
    return this.remember("listInstitutions", () => this.inner.listInstitutions());
  }

  public getInstitution(slug: string) {
    return this.remember(`institution:${slug}`, () => this.inner.getInstitution(slug));
  }

  public listLineage() {
    return this.remember("listLineage", () => this.inner.listLineage());
  }

  public listResidencies() {
    return this.remember("listResidencies", () => this.inner.listResidencies());
  }

  public listLifeEvents() {
    return this.remember("listLifeEvents", () => this.inner.listLifeEvents());
  }

  public getEvidence(sourceId: string) {
    return this.remember(`evidence:${sourceId}`, () => this.inner.getEvidence(sourceId));
  }

  public stats() {
    return this.remember("stats", () => this.inner.stats());
  }

  private remember<T>(key: string, load: () => Promise<PublicReadResult<T>>): Promise<PublicReadResult<T>> {
    return this.cache.remember(key, load, (result) => result.kind !== "unavailable");
  }
}
