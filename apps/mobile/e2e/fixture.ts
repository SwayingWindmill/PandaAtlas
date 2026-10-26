import { readFileSync } from "node:fs";
import path from "node:path";

/** What e2e/global-setup.ts published for this run. */
export interface Fixture {
  panda: { id: string; slug: string; name: string };
  /** A second published panda, followed and taken down by the notification journey. */
  notice: { id: string; slug: string; name: string };
}

export function fixture(): Fixture {
  return JSON.parse(readFileSync(path.join(__dirname, ".state.json"), "utf8")) as Fixture;
}

/** Today as the app shows it, e.g. "10月26日". */
export function todayLabel(now = new Date()): string {
  return `${now.getMonth() + 1}月${now.getDate()}日`;
}
