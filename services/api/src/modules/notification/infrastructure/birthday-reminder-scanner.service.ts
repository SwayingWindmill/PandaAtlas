import { randomUUID } from "node:crypto";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { IntegrationEventInput } from "../../../platform/integration/integration-outbox.service.js";
import type { PublicPandaSummary, PublicReadPort } from "../../public-read/application/public-read.application.js";

export interface BirthdayScannerDatabase<Tx> {
  transaction<T>(callback: (transaction: Tx) => Promise<T>): Promise<T>;
}

export interface BirthdayScannerOutbox<Tx> {
  appendIfAbsent(transaction: Tx, event: IntegrationEventInput): Promise<string | undefined>;
}

export interface BirthdayScannerAudience<Tx> {
  listFavoritedPandaIds(transaction: Tx): Promise<string[]>;
}

const CST_OFFSET_MS = 8 * 3_600_000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DuePandaBirthday {
  pandaId: string;
  pandaSlug: string;
  pandaName: string;
  birthdayDate: string;
  age: number;
  leadDays: 0 | 1;
}

function readFactValue(panda: PublicPandaSummary, fieldKeys: readonly string[]): unknown {
  for (const fieldKey of fieldKeys) {
    const found = panda.facts.find((fact) => fact.fieldKey === fieldKey);
    if (found?.value !== undefined && found.value !== null) {
      return found.value;
    }
  }
  return undefined;
}

function isLivingPanda(panda: PublicPandaSummary): boolean {
  const lifeStatus = readFactValue(panda, ["life_status", "identity.life_status"]);
  if (lifeStatus === "deceased") return false;
  const deathDate = readFactValue(panda, ["death_date", "identity.death_date"]);
  return !(typeof deathDate === "string" && deathDate.trim() !== "");
}

function primaryPandaName(panda: PublicPandaSummary): string {
  const zhPrimary = panda.names.find(
    (name) => name.isPrimary && name.languageTag.toLowerCase().startsWith("zh") && name.value.trim() !== "",
  );
  if (zhPrimary !== undefined) return zhPrimary.value.trim();
  const anyPrimary = panda.names.find((name) => name.isPrimary && name.value.trim() !== "");
  if (anyPrimary !== undefined) return anyPrimary.value.trim();
  const firstNamed = panda.names.find((name) => name.value.trim() !== "");
  return firstNamed?.value.trim() ?? panda.canonicalSlug;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function cstClock(now: Date): { hour: number; today: string; tomorrow: string } {
  const cstNow = new Date(now.getTime() + CST_OFFSET_MS);
  const tomorrowDate = new Date(cstNow.getTime() + 86_400_000);
  return {
    hour: cstNow.getUTCHours(),
    today: cstNow.toISOString().slice(0, 10),
    tomorrow: tomorrowDate.toISOString().slice(0, 10),
  };
}

export function findDuePandaBirthdays(
  pandas: readonly PublicPandaSummary[],
  now = new Date(),
): DuePandaBirthday[] {
  const clock = cstClock(now);
  if (clock.hour < 8) return [];

  const targets: readonly { date: string; leadDays: 0 | 1 }[] = [
    { date: clock.today, leadDays: 0 },
    { date: clock.tomorrow, leadDays: 1 },
  ];
  const due: DuePandaBirthday[] = [];

  for (const panda of pandas) {
    if (!isLivingPanda(panda)) continue;
    const rawBirthDate = readFactValue(panda, ["birth_date", "identity.birth_date"]);
    if (typeof rawBirthDate !== "string") continue;
    const match = DAY_PATTERN.exec(rawBirthDate.trim());
    if (match === null) continue;

    const birthYear = Number(match[1]);
    const birthMonth = Number(match[2]);
    const birthDay = Number(match[3]);
    if (!Number.isInteger(birthYear) || !Number.isInteger(birthMonth) || !Number.isInteger(birthDay)) {
      continue;
    }

    for (const target of targets) {
      const targetYear = Number(target.date.slice(0, 4));
      const targetMonth = Number(target.date.slice(5, 7));
      const targetDay = Number(target.date.slice(8, 10));
      const age = targetYear - birthYear;
      if (age < 1) continue;
      const celebrationDay = Math.min(birthDay, daysInMonth(targetYear, birthMonth));
      if (targetMonth === birthMonth && targetDay === celebrationDay) {
        due.push({
          pandaId: panda.pandaId,
          pandaSlug: panda.canonicalSlug,
          pandaName: primaryPandaName(panda),
          birthdayDate: target.date,
          age,
          leadDays: target.leadDays,
        });
      }
    }
  }

  return due.sort((left, right) => left.leadDays - right.leadDays || left.pandaId.localeCompare(right.pandaId));
}

export class BirthdayReminderScannerService<Tx = DatabaseTransaction> {
  public constructor(
    private readonly database: BirthdayScannerDatabase<Tx>,
    private readonly outbox: BirthdayScannerOutbox<Tx>,
    private readonly audience: BirthdayScannerAudience<Tx>,
    private readonly publicRead: Pick<PublicReadPort, "listPandas">,
  ) {}

  public async scanDueReminders(now = new Date()): Promise<{ scanned: number; emitted: number }> {
    if (cstClock(now).hour < 8) {
      return { scanned: 0, emitted: 0 };
    }

    const favoritedIds = await this.database.transaction((transaction) =>
      this.audience.listFavoritedPandaIds(transaction),
    );
    if (favoritedIds.length === 0) {
      return { scanned: 0, emitted: 0 };
    }

    const published = await this.publicRead.listPandas();
    if (published.kind !== "ok") {
      return { scanned: 0, emitted: 0 };
    }

    const watchedSet = new Set(favoritedIds);
    const watchedPandas = published.value.items.filter((panda) => watchedSet.has(panda.pandaId));
    const dueBirthdays = findDuePandaBirthdays(watchedPandas, now);
    if (dueBirthdays.length === 0) {
      return { scanned: watchedPandas.length, emitted: 0 };
    }

    let emitted = 0;
    await this.database.transaction(async (transaction) => {
      for (const due of dueBirthdays) {
        const eventId = await this.outbox.appendIfAbsent(transaction, {
          eventType: "notification.birthday.due",
          sourceContext: "notification",
          aggregateType: "panda",
          aggregateId: due.pandaId,
          idempotencyKey: `birthday:${due.pandaId}:${due.birthdayDate}:lead${due.leadDays}`,
          correlationId: randomUUID(),
          occurredAt: now,
          payload: {
            pandaId: due.pandaId,
            pandaSlug: due.pandaSlug,
            pandaName: due.pandaName,
            birthdayDate: due.birthdayDate,
            age: due.age,
            leadDays: due.leadDays,
          },
        });
        if (eventId !== undefined) emitted += 1;
      }
    });

    return { scanned: watchedPandas.length, emitted };
  }
}
