import {
  acceptsToday,
  decideCancelLeave,
  decideLeave,
  decideVisit,
  summarizeDailyCheckins,
  type DailyCheckinDecision,
  type DailyCheckinRecord,
  type DailyCheckinRefusal,
  type DailyCheckinSummary,
} from "./daily-checkin.js";

export type DailyCheckinResult =
  | { ok: true; summary: DailyCheckinSummary }
  | { ok: false; refusal: DailyCheckinRefusal };

export interface DailyCheckinRepository {
  listDailyCheckins(accountId: string): Promise<DailyCheckinRecord[]>;
  /**
   * Serializes one member's check-in edits: reads their days, lets `decide`
   * choose a change, applies it and returns the days after the change.
   */
  editDailyCheckins(
    accountId: string,
    decide: (records: DailyCheckinRecord[]) => DailyCheckinDecision,
  ): Promise<{ decision: DailyCheckinDecision; records: DailyCheckinRecord[] }>;
}

export interface DailyCheckinPort {
  dailyCheckins(accountId: string, today: string): Promise<DailyCheckinResult>;
  recordDailyVisit(accountId: string, today: string): Promise<DailyCheckinResult>;
  takeDailyLeave(accountId: string, day: string, today: string): Promise<DailyCheckinResult>;
  cancelDailyLeave(accountId: string, day: string, today: string): Promise<DailyCheckinResult>;
}

export const DAILY_CHECKIN_PORT = Symbol("DAILY_CHECKIN_PORT");

export class DailyCheckinApplication implements DailyCheckinPort {
  public constructor(
    private readonly repository: DailyCheckinRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async dailyCheckins(accountId: string, today: string): Promise<DailyCheckinResult> {
    if (!acceptsToday(today, this.now())) return { ok: false, refusal: "todayOutOfRange" };
    return { ok: true, summary: summarizeDailyCheckins(await this.repository.listDailyCheckins(accountId), today) };
  }

  public recordDailyVisit(accountId: string, today: string): Promise<DailyCheckinResult> {
    return this.editDailyCheckins(accountId, today, (records) => decideVisit(records, today));
  }

  public takeDailyLeave(accountId: string, day: string, today: string): Promise<DailyCheckinResult> {
    return this.editDailyCheckins(accountId, today, (records) => decideLeave(records, day, today));
  }

  public cancelDailyLeave(accountId: string, day: string, today: string): Promise<DailyCheckinResult> {
    return this.editDailyCheckins(accountId, today, (records) => decideCancelLeave(records, day, today));
  }

  private async editDailyCheckins(
    accountId: string,
    today: string,
    decide: (records: DailyCheckinRecord[]) => DailyCheckinDecision,
  ): Promise<DailyCheckinResult> {
    if (!acceptsToday(today, this.now())) return { ok: false, refusal: "todayOutOfRange" };
    const { decision, records } = await this.repository.editDailyCheckins(accountId, decide);
    if (!decision.ok) return { ok: false, refusal: decision.refusal };
    return { ok: true, summary: summarizeDailyCheckins(records, today) };
  }
}
