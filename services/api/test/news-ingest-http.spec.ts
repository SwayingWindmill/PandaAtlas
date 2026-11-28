import { ValidationPipe } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  FactCandidateRecord,
  NewsIngestPersistenceInput,
  NewsItemStatus,
  NewsRepository,
  NewsReviewItem,
} from "../src/modules/news/application/news.application.js";
import { decodeNewsCursor, encodeNewsCursor, NewsApplication } from "../src/modules/news/application/news.application.js";
import { NewsController } from "../src/modules/news/http/news.controller.js";
import { NewsIngestBatchDto } from "../src/modules/news/http/news.dto.js";
import type { PublicReadPort } from "../src/modules/public-read/application/public-read.application.js";
import type { AppConfig } from "../src/platform/config/app-config.js";
import { DomainError } from "../src/platform/errors/domain-error.js";
import { RequestContextService } from "../src/platform/request-context/request-context.service.js";

function memoryNewsRepository(): {
  repo: NewsRepository;
  items: Map<string, NewsReviewItem>;
  candidates: Map<string, FactCandidateRecord>;
} {
  const items = new Map<string, NewsReviewItem>();
  const candidates = new Map<string, FactCandidateRecord>();

  const repo: NewsRepository = {
    upsertIngestedBatch(batch: readonly NewsIngestPersistenceInput[]) {
      let published = 0;
      let pendingReview = 0;
      let factCandidatesCreated = 0;

      for (const entry of batch) {
        const existing = [...items.values()].find((item) => item.externalId === entry.externalId);
        let newsItemId: string;
        if (existing === undefined) {
          newsItemId = randomUUID();
          const record: NewsReviewItem = {
            newsItemId,
            externalId: entry.externalId,
            platform: entry.platform,
            sourceTier: entry.sourceTier,
            kind: entry.kind,
            titleZh: entry.titleZh,
            summaryZh: entry.summaryZh,
            sourceUrl: entry.sourceUrl,
            sourcePublisher: entry.sourcePublisher,
            ...(entry.coverUrl ? { coverUrl: entry.coverUrl } : {}),
            pandaIds: entry.pandaIds,
            pandaSlugs: entry.pandaSlugs,
            rawPandaNames: entry.rawPandaNames,
            ...(entry.institutionId ? { institutionId: entry.institutionId } : {}),
            ...(entry.institutionSlug ? { institutionSlug: entry.institutionSlug } : {}),
            ...(entry.institutionName ? { institutionName: entry.institutionName } : {}),
            publishedAt: entry.publishedAt.toISOString(),
            status: entry.initialStatus,
            createdAt: new Date().toISOString(),
          };
          items.set(newsItemId, record);
          if (record.status === "published") published += 1;
          else pendingReview += 1;
        } else {
          newsItemId = existing.newsItemId;
          if (existing.status !== "hidden" && existing.status !== "rejected") {
            items.set(newsItemId, {
              ...existing,
              titleZh: entry.titleZh,
              summaryZh: entry.summaryZh,
              ...(entry.coverUrl ? { coverUrl: entry.coverUrl } : {}),
            });
          }
        }

        if (entry.factCandidate !== undefined && !candidates.has(entry.factCandidate.candidateKey)) {
          candidates.set(entry.factCandidate.candidateKey, {
            candidateId: randomUUID(),
            candidateKey: entry.factCandidate.candidateKey,
            newsItemId,
            kind: entry.factCandidate.kind,
            gateStatus: entry.factCandidate.gateStatus,
            reviewState: "pending_review",
            rawPandaNames: entry.rawPandaNames,
            changePayload: entry.factCandidate.changePayload,
            evidenceItems: [{ ...entry.factCandidate.evidence, newsItemId }],
            createdAt: new Date().toISOString(),
          });
          factCandidatesCreated += 1;
        }
      }

      return Promise.resolve({ accepted: batch.length, published, pendingReview, factCandidatesCreated });
    },
    listPublicNews() {
      return Promise.resolve([...items.values()].filter((item) => item.status === "published"));
    },
    listPublishedOfficialVenueNews() {
      return Promise.resolve([]);
    },
    listReviewItems({ status }) {
      return Promise.resolve([...items.values()].filter((item) => status === undefined || item.status === status));
    },
    decideReviewItem(input) {
      const found = items.get(input.newsItemId);
      if (found === undefined) return Promise.resolve(undefined);
      const nextStatus: NewsItemStatus =
        input.decision === "publish" ? "published" : input.decision === "reject" ? "rejected" : "hidden";
      const updated = { ...found, status: nextStatus, reviewNote: input.reviewNote };
      items.set(found.newsItemId, updated);
      return Promise.resolve(updated);
    },
    listFactCandidates() {
      return Promise.resolve([...candidates.values()]);
    },
    decideFactCandidate() {
      return Promise.resolve(undefined);
    },
  };

  return { repo, items, candidates };
}

function stubPublicRead(): PublicReadPort {
  return {
    listPandas: () =>
      Promise.resolve({
        kind: "ok",
        value: {
          release: { releaseId: "r1", version: "v1" },
          items: [
            {
              pandaId: "p-hehua",
              canonicalSlug: "he-hua-chengdu",
              legacySlugs: [],
              names: [{ languageTag: "zh-CN", nameKind: "primary", value: "和花", isPrimary: true }],
              facts: [],
              currentPlace: { placeId: "pl-cd", slug: "chengdu-base", placeType: "facility" },
            },
          ],
        },
      }),
    listInstitutions: () =>
      Promise.resolve({
        kind: "ok",
        value: {
          release: { releaseId: "r1", version: "v1" },
          items: [
            { institutionId: "inst-cd", slug: "chengdu-research-base", nameZh: "成都大熊猫繁育研究基地" },
          ],
        },
      }),
    listPlaces: () =>
      Promise.resolve({
        kind: "ok",
        value: {
          release: { releaseId: "r1", version: "v1" },
          items: [{ placeId: "pl-cd", institutionId: "inst-cd", slug: "chengdu-base", placeType: "facility" }],
        },
      }),
    listResidencies: () => Promise.resolve({ kind: "ok", value: { release: { releaseId: "r1", version: "v1" }, items: [] } }),
  } as unknown as PublicReadPort;
}

describe("NewsController & NewsApplication ingest guardrails", () => {
  it("enforces ingest bearer token auth, strips non-T1 coverUrl, and never resurrects hidden items", async () => {
    const { repo, items, candidates } = memoryNewsRepository();
    const app = new NewsApplication(repo, stubPublicRead(), new Set(["institution", "official"]));
    const requestContext = new RequestContextService();

    const disabledController = new NewsController(app, { newsIngestToken: undefined } as AppConfig, requestContext);
    await expect(
      Promise.resolve().then(() => disabledController.ingest({ headers: {} } as never, { items: [] })),
    ).rejects.toMatchObject({ code: "news.ingestDisabled" });

    const enabledController = new NewsController(
      app,
      { newsIngestToken: "news-secret-token-1234" } as AppConfig,
      requestContext,
    );

    await expect(
      Promise.resolve().then(() =>
        enabledController.ingest({ headers: { authorization: "Bearer wrong-token" } } as never, { items: [] }),
      ),
    ).rejects.toMatchObject({ code: "news.invalidIngestToken" });

    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const dto = (await pipe.transform(
      {
        items: [
          {
            externalId: "weibo:t1-01",
            platform: "weibo",
            sourceTier: "institution",
            authorInstitutionSlug: "chengdu-research-base",
            sourceUrl: "https://weibo.com/1798176285/t1-01",
            sourcePublisher: "成都大熊猫繁育研究基地",
            publishedAt: "2026-11-28T08:00:00+08:00",
            kind: "closure",
            scope: "single",
            titleZh: "幼年别墅今日闭馆消毒",
            summaryZh: "成都基地宣布幼年别墅今日闭馆消毒一天。",
            pandaNames: ["和花"],
            institutionName: "成都大熊猫繁育研究基地",
            coverUrl: "https://cdn.example.org/t1-cover.jpg",
            factChange: { kind: "birth", date: "2026-11-28", motherName: "和花" },
            evidenceQuote: "原文确认",
          },
          {
            externalId: "douban:fan-01",
            platform: "douban",
            sourceTier: "fan",
            sourceUrl: "https://www.douban.com/group/topic/1002/",
            sourcePublisher: "豆瓣公开小组(745379)",
            publishedAt: "2026-11-28T09:00:00+08:00",
            kind: "event",
            scope: "single",
            titleZh: "网友分享和花动态",
            summaryZh: "粉丝讨论和花今天外场情况。",
            pandaNames: ["和花"],
            coverUrl: "https://fan.example.org/should-be-stripped.jpg",
          },
        ],
      },
      { type: "body", metatype: NewsIngestBatchDto },
    )) as NewsIngestBatchDto;

    const res = await enabledController.ingest(
      { headers: { authorization: "Bearer news-secret-token-1234" } } as never,
      dto,
    );
    expect(res).toEqual({ accepted: 2, published: 1, pendingReview: 1, factCandidatesCreated: 1 });

    const t1Item = [...items.values()].find((item) => item.externalId === "weibo:t1-01");
    const fanItem = [...items.values()].find((item) => item.externalId === "douban:fan-01");
    expect(t1Item?.coverUrl).toBe("https://cdn.example.org/t1-cover.jpg");
    expect(t1Item?.status).toBe("published");
    expect(fanItem?.coverUrl).toBeUndefined();
    expect(fanItem?.status).toBe("pending_review");
    expect([...candidates.values()][0]?.reviewState).toBe("pending_review");

    // Hide the T1 item, then re-ingest the same externalId: hidden status must persist.
    await repo.decideReviewItem({
      newsItemId: t1Item!.newsItemId,
      actorAccountId: randomUUID(),
      decision: "hide",
      reviewNote: "Operator hid item",
      correlationId: randomUUID(),
    });
    await enabledController.ingest(
      { headers: { authorization: "Bearer news-secret-token-1234" } } as never,
      dto,
    );
    expect(items.get(t1Item!.newsItemId)?.status).toBe("hidden");
  });

  it("rejects cursors whose id is not a UUID", () => {
    const valid = encodeNewsCursor("2026-11-28T08:00:00.000Z", randomUUID());
    expect(decodeNewsCursor(valid).publishedAt).toBe("2026-11-28T08:00:00.000Z");

    const invalidId = encodeNewsCursor("2026-11-28T08:00:00.000Z", "not-a-uuid");
    expect(() => decodeNewsCursor(invalidId)).toThrowError(DomainError);
    expect(() => decodeNewsCursor(invalidId)).toThrow(/cursor is malformed/);
  });
});
