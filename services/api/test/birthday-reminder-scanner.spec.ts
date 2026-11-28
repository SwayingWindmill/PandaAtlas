import { describe, expect, it } from "vitest";
import {
  BirthdayReminderScannerService,
  type BirthdayScannerAudience,
  type BirthdayScannerDatabase,
  type BirthdayScannerOutbox,
  findDuePandaBirthdays,
} from "../src/modules/notification/infrastructure/birthday-reminder-scanner.service.js";
import type { PublicPandaSummary, PublicReadPort } from "../src/modules/public-read/application/public-read.application.js";

function pandaSummary(
  overrides: Partial<PublicPandaSummary> & { pandaId: string; birthDate?: string; lifeStatus?: string; deathDate?: string },
): PublicPandaSummary {
  const facts: PublicPandaSummary["facts"] = [];
  if (overrides.birthDate !== undefined) {
    facts.push({ fieldKey: "birth_date", value: overrides.birthDate, status: "verified", lastVerifiedOn: "2026-07-01", conclusionVersion: 1 });
  }
  if (overrides.lifeStatus !== undefined) {
    facts.push({ fieldKey: "life_status", value: overrides.lifeStatus, status: "verified", lastVerifiedOn: "2026-07-01", conclusionVersion: 1 });
  }
  if (overrides.deathDate !== undefined) {
    facts.push({ fieldKey: "death_date", value: overrides.deathDate, status: "verified", lastVerifiedOn: "2026-07-01", conclusionVersion: 1 });
  }
  return {
    pandaId: overrides.pandaId,
    canonicalSlug: overrides.canonicalSlug ?? `panda-${overrides.pandaId}`,
    legacySlugs: [],
    names: overrides.names ?? [{ languageTag: "zh-CN", nameKind: "primary", value: `熊猫${overrides.pandaId}`, isPrimary: true }],
    facts: overrides.facts ?? facts,
  };
}

describe("BirthdayReminderScanner", () => {
  it("matches today and tomorrow birthdays in UTC+8 after 08:00 CST and suppresses earlier hours", () => {
    const pandas = [
      pandaSummary({ pandaId: "p-today", canonicalSlug: "he-hua", birthDate: "2020-07-04", lifeStatus: "alive", names: [{ languageTag: "zh-CN", nameKind: "primary", value: "和花", isPrimary: true }] }),
      pandaSummary({ pandaId: "p-tomorrow", canonicalSlug: "meng-lan", birthDate: "2015-07-05", lifeStatus: "alive", names: [{ languageTag: "zh-CN", nameKind: "primary", value: "萌兰", isPrimary: true }] }),
      pandaSummary({ pandaId: "p-deceased", birthDate: "2000-07-04", lifeStatus: "deceased" }),
      pandaSummary({ pandaId: "p-newborn", birthDate: "2026-07-04", lifeStatus: "alive" }),
    ];

    expect(findDuePandaBirthdays(pandas, new Date("2026-07-04T07:30:00+08:00"))).toEqual([]);

    expect(findDuePandaBirthdays(pandas, new Date("2026-07-04T08:00:00+08:00"))).toEqual([
      {
        pandaId: "p-today",
        pandaSlug: "he-hua",
        pandaName: "和花",
        birthdayDate: "2026-07-04",
        age: 6,
        leadDays: 0,
      },
      {
        pandaId: "p-tomorrow",
        pandaSlug: "meng-lan",
        pandaName: "萌兰",
        birthdayDate: "2026-07-05",
        age: 11,
        leadDays: 1,
      },
    ]);
  });

  it("maps Feb 29 birthdays onto Feb 28 in non-leap years", () => {
    const pandas = [pandaSummary({ pandaId: "p-leap", canonicalSlug: "leap-bear", birthDate: "2024-02-29" })];
    expect(findDuePandaBirthdays(pandas, new Date("2026-02-28T09:00:00+08:00"))).toEqual([
      {
        pandaId: "p-leap",
        pandaSlug: "leap-bear",
        pandaName: "熊猫p-leap",
        birthdayDate: "2026-02-28",
        age: 2,
        leadDays: 0,
      },
    ]);
  });

  it("deduplicates repeated scans on the same day via outbox.appendIfAbsent", async () => {
    const seenKeys = new Set<string>();
    const fakeTx = { fake: true };
    const fakeDatabase: BirthdayScannerDatabase<typeof fakeTx> = {
      transaction: (callback) => callback(fakeTx),
    };
    const fakeOutbox: BirthdayScannerOutbox<typeof fakeTx> = {
      appendIfAbsent: (_tx, event) => {
        const key = `${event.sourceContext}:${event.idempotencyKey}`;
        if (seenKeys.has(key)) return Promise.resolve(undefined);
        seenKeys.add(key);
        return Promise.resolve(`evt-${seenKeys.size}`);
      },
    };
    const fakeAudience: BirthdayScannerAudience<typeof fakeTx> = {
      listFavoritedPandaIds: () => Promise.resolve(["p-watched"]),
    };
    const fakePublicRead: Pick<PublicReadPort, "listPandas"> = {
      listPandas: () =>
        Promise.resolve({
          kind: "ok",
          value: {
            release: { releaseId: "r1", version: "2026.07.04.1" },
            items: [
              pandaSummary({ pandaId: "p-watched", canonicalSlug: "fu-bao", birthDate: "2020-07-04" }),
              pandaSummary({ pandaId: "p-unwatched", canonicalSlug: "other", birthDate: "2020-07-04" }),
            ],
          },
        }),
    };

    const scanner = new BirthdayReminderScannerService(fakeDatabase, fakeOutbox, fakeAudience, fakePublicRead);

    const noonCst = new Date("2026-07-04T12:00:00+08:00");
    await expect(scanner.scanDueReminders(noonCst)).resolves.toEqual({ scanned: 1, emitted: 1 });
    await expect(scanner.scanDueReminders(noonCst)).resolves.toEqual({ scanned: 1, emitted: 0 });
  });
});
