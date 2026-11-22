import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AsyncDownstreamRunnerService } from "../jobs/async-downstream-runner.service.js";
import { EVIDENCE_PORT, type EvidencePort } from "../modules/evidence/application/evidence.application.js";
import { LIFE_HISTORY_PORT, type LifeHistoryPort } from "../modules/life-history/application/life-history.application.js";
import { LINEAGE_PORT, type LineagePort, type ParentRole } from "../modules/lineage/application/lineage.application.js";
import { MEDIA_PORT, type MediaPort } from "../modules/media/application/media.application.js";
import { PANDA_PORT, type PandaPort } from "../modules/panda/application/panda.application.js";
import { PLACES_PORT, type PlacesPort } from "../modules/places/application/places.application.js";
import {
  PUBLICATION_INSPECTION_PORT,
  type PublicationInspectionPort,
} from "../modules/publication/application/publication-inspection.port.js";
import {
  PUBLICATION_PORT,
  type PublicationCommandContext,
  type PublicationPort,
} from "../modules/publication/application/publication.application.js";
import { publishRelease } from "../modules/publication/application/release-command.js";
import type { ReleaseManifest } from "../modules/publication/application/release-manifest.js";
import { DatabaseService } from "../platform/database/database.service.js";
import { RecentAuthCutoffStore } from "./recent-auth-cutoff.store.js";

const E2E_TIME_ZONE = "Asia/Shanghai";

export function shanghaiMonthDay(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD; slice MM-DD so seeded birthdays match e2e.config.ts timezoneId
  // even when e2e's ManagedProcess strips TZ from stack.ts.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: E2E_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .slice(5);
}

export interface MobileJourneySeedResult {
  panda: { id: string; slug: string; name: string };
  notice: { id: string; slug: string; name: string };
  zoo: { slug: string; name: string; facility: string };
}

@Injectable()
export class E2eFixtureService {
  public constructor(
    @Inject(EVIDENCE_PORT) private readonly evidence: EvidencePort,
    @Inject(PANDA_PORT) private readonly pandas: PandaPort,
    @Inject(LINEAGE_PORT) private readonly lineage: LineagePort,
    @Inject(PLACES_PORT) private readonly places: PlacesPort,
    @Inject(LIFE_HISTORY_PORT) private readonly lifeHistory: LifeHistoryPort,
    @Inject(MEDIA_PORT) private readonly media: MediaPort,
    @Inject(PUBLICATION_PORT) private readonly publication: PublicationPort,
    @Inject(PUBLICATION_INSPECTION_PORT) private readonly inspection: PublicationInspectionPort,
    private readonly runner: AsyncDownstreamRunnerService,
    private readonly database: DatabaseService,
    private readonly cutoffs: RecentAuthCutoffStore,
  ) {}

  public async seedMobileJourneys(): Promise<MobileJourneySeedResult> {
    const run = randomUUID().slice(0, 8);
    const sourceId = `e2e:${run}`;

    await this.evidence.createSource({
      sourceId,
      publisher: "E2E Archive",
      title: "End-to-end fixture source",
      url: `https://example.test/e2e/${run}`,
      publishedOn: "2026-10-26",
      lastVerifiedOn: "2026-10-26",
      languageTag: "zh-Hans",
      accessState: "accessible",
      evidenceTier: "institutional",
      publicSummary: "End-to-end fixture.",
      contentSha256: "c".repeat(64),
    });

    const slug = `e2e-panda-${run}`;
    const panda = await this.pandas.createPanda({
      canonicalSlug: slug,
      primaryName: { languageTag: "zh-Hans", value: `测试熊猫${run}`, sourceIds: [sourceId] },
    });
    for (const [index, fact] of [
      { fieldKey: "sex", value: "female" },
      { fieldKey: "birth_date", value: "2020-07-20" },
    ].entries()) {
      const assertionId = `e2e-fact-${index}:${run}`;
      await this.pandas.recordFactAssertion({
        assertionId,
        pandaId: panda.pandaId,
        ...fact,
        certainty: "confirmed",
        lastVerifiedOn: "2026-10-26",
        sourceIds: [sourceId],
      });
      await this.pandas.setFactConclusion({
        pandaId: panda.pandaId,
        ...fact,
        status: "confirmed",
        lastVerifiedOn: "2026-10-26",
        assertionIds: [assertionId],
      });
    }

    const others = [];
    for (const letter of ["乙", "丙", "丁"] as const) {
      const code = letter.codePointAt(0) ?? 0;
      others.push(
        await this.pandas.createPanda({
          canonicalSlug: `e2e-option-${code}-${run}`,
          primaryName: { languageTag: "zh-Hans", value: `选项${letter}${run}`, sourceIds: [sourceId] },
        }),
      );
    }
    const [optionB, optionC, optionD] = others;
    if (!optionB || !optionC || !optionD) {
      throw new Error("Expected three option pandas for E2E fixture seeding.");
    }

    const today = shanghaiMonthDay();
    const birthdayAssertionId = `e2e-birthday:${run}`;
    const birthdayFact = { fieldKey: "birth_date", value: `2010-${today}` };
    await this.pandas.recordFactAssertion({
      assertionId: birthdayAssertionId,
      pandaId: optionD.pandaId,
      ...birthdayFact,
      certainty: "confirmed",
      lastVerifiedOn: "2026-10-26",
      sourceIds: [sourceId],
    });
    await this.pandas.setFactConclusion({
      pandaId: optionD.pandaId,
      ...birthdayFact,
      status: "confirmed",
      lastVerifiedOn: "2026-10-26",
      assertionIds: [birthdayAssertionId],
    });

    const lineageLinks: ReadonlyArray<readonly [string, string, ParentRole]> = [
      [panda.pandaId, optionC.pandaId, "mother"],
      [panda.pandaId, optionD.pandaId, "father"],
      [optionB.pandaId, optionC.pandaId, "mother"],
    ];
    for (const [index, [childId, parentId, parentRole]] of lineageLinks.entries()) {
      await this.lineage.createAssertion({
        assertionId: `e2e-parent-${index}:${run}`,
        childId,
        parentId,
        parentRole,
        status: "confirmed",
        sourceIds: [sourceId],
      });
    }

    const zoo = {
      slug: `e2e-zoo-${run}`,
      name: `测试动物园${run}`,
      facility: `测试动物园熊猫馆${run}`,
    };
    const institution = await this.places.createInstitution({
      slug: zoo.slug,
      nameZh: zoo.name,
      countryCode: "CN",
      profile: { kind: "zoo", verifiedOn: "2026-10-27", sourceUrls: [`https://example.test/zoo/${run}`] },
    });
    const facility = await this.places.createPlace({
      institutionId: institution.institutionId,
      slug: `e2e-zoo-facility-${run}`,
      placeType: "facility",
      region: "Chengdu, Sichuan",
      nameZh: zoo.facility,
      countryCode: "CN",
      // Coordinates sit in Beijing so the pin is isolated from Sichuan bases while keeping Chengdu region filtering.
      center: { longitude: 116.3394, latitude: 39.9375 },
    });
    await this.places.createPlace({
      slug: `e2e-place-${run}`,
      placeType: "facility",
      nameZh: `测试地点${run}`,
      countryCode: "JP",
      region: "Tokyo",
    });

    await this.lifeHistory.createResidency({
      residencyId: `e2e-home:${run}`,
      pandaId: panda.pandaId,
      placeId: facility.placeId,
      residencyType: "primary",
      startOn: "2021-03-01",
      startPrecision: "day",
      status: "confirmed",
      sourceIds: [sourceId],
    });

    const photo = await this.media.createAsset({
      sourceId,
      storageBucket: "panda-media",
      storageKey: `e2e/${run}.jpg`,
      contentSha256: "d".repeat(64),
      mediaType: "image/jpeg",
      byteSize: 1024,
      title: "E2E panda",
      creator: "E2E Photographer",
      license: "CC-BY-4.0",
      attributionText: "E2E Photographer / CC BY 4.0",
      rightsStatus: "cleared",
      eligibilityStatus: "eligible",
      metadata: { purpose: "mobile-e2e" },
    });
    await this.media.attachToPanda(panda.pandaId, photo.assetId, "cover", 0);

    const second = await this.media.createAsset({
      sourceId,
      storageBucket: "panda-media",
      storageKey: `e2e/${run}-2.jpg`,
      contentSha256: "e".repeat(64),
      mediaType: "image/jpeg",
      byteSize: 1024,
      title: "E2E panda, second photo",
      creator: "E2E Second Photographer",
      license: "CC-BY-4.0",
      attributionText: "E2E Second Photographer / CC BY 4.0",
      rightsStatus: "cleared",
      eligibilityStatus: "eligible",
      metadata: { purpose: "mobile-e2e" },
    });
    await this.media.attachToPanda(panda.pandaId, second.assetId, "gallery", 1);

    await this.database.db
      .insertInto("game.questions")
      .values({
        target_panda_id: panda.pandaId,
        media_asset_id: photo.assetId,
        difficulty: "easy",
        option_panda_ids: [panda.pandaId, ...others.map((other) => other.pandaId)],
        recognition_tips: JSON.stringify(["看眼圈的形状。"]),
        state: "published",
        published_at: new Date(),
      })
      .execute();

    const manifest: ReleaseManifest = {
      version: `2099.01.01.${Date.now()}`,
      action: "publish",
      reason: "End-to-end journeys fixture release.",
    };
    const context: PublicationCommandContext = {
      actor: { kind: "system", systemKey: "release-batch-workflow" },
      correlationId: randomUUID(),
    };
    await publishRelease(
      { publication: this.publication, inspection: this.inspection },
      manifest,
      context,
      manifest.reason,
    );

    const optionBCode = "乙".codePointAt(0) ?? 0;
    return {
      panda: { id: panda.pandaId, slug, name: `测试熊猫${run}` },
      notice: {
        id: optionB.pandaId,
        slug: `e2e-option-${optionBCode}-${run}`,
        name: `选项乙${run}`,
      },
      zoo,
    };
  }

  public async runScheduledCycles(cycles = 4): Promise<{ cycles: number }> {
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      await this.runner.runCycle({ publicCache: { purge: () => Promise.resolve() } });
    }
    return { cycles };
  }

  public async takeDownAndRestore(pandaId: string): Promise<{ pandaId: string; cycles: number }> {
    const context: PublicationCommandContext = {
      actor: { kind: "system", systemKey: "mobile-e2e" },
      correlationId: randomUUID(),
    };
    await this.publication.setResourceTakedown("panda", pandaId, true, context, "End-to-end review hold.");
    await this.publication.setResourceTakedown("panda", pandaId, false, context, "End-to-end review done.");
    const result = await this.runScheduledCycles(4);
    return { pandaId, cycles: result.cycles };
  }

  public expireRecentAuth(
    accountId: string,
    afterEpochSeconds?: number,
  ): { accountId: string; cutoffMs: number } {
    return {
      accountId,
      cutoffMs: this.cutoffs.expire(accountId, afterEpochSeconds),
    };
  }
}
