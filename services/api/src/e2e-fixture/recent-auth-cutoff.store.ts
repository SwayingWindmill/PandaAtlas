import { Injectable } from "@nestjs/common";

/** Test-only in-memory watermark for expiring interactive auth without touching Supabase `auth.*` tables. */
@Injectable()
export class RecentAuthCutoffStore {
  private readonly cutoffs = new Map<string, number>();

  public expire(accountId: string, afterEpochSeconds?: number): number {
    const cutoffMs = (afterEpochSeconds ?? Math.floor(Date.now() / 1_000)) * 1_000;
    const next = Math.max(this.cutoffs.get(accountId) ?? 0, cutoffMs);
    this.cutoffs.set(accountId, next);
    return next;
  }

  public cutoffFor(accountId: string): number | undefined {
    return this.cutoffs.get(accountId);
  }
}
