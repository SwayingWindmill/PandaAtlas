import { readFileSync } from "node:fs";
import path from "node:path";

/** What tests/support/stack.ts published and started for this run. */
export interface Fixture {
  panda: { id: string; slug: string; name: string };
  /** A second published panda, followed and taken down by the notification journey. */
  notice: { id: string; slug: string; name: string };
  /** A published zoo with one facility, for 到访. */
  zoo: { slug: string; name: string; facility: string };
  /** Supabase's local mail catcher, where sign-in codes arrive. */
  mailpitUrl: string;
  /** The API's configuration, for steps that run through its compiled modules (backend.ts). */
  apiEnv: Record<string, string>;
}

export const statePath = path.join(import.meta.dirname, ".state.json");

export function fixture(): Fixture {
  return JSON.parse(readFileSync(statePath, "utf8")) as Fixture;
}

/** The suffix every fixture name of this run carries, e.g. 选项丙<run>. */
export function runSuffix(): string {
  return fixture().panda.name.replace("测试熊猫", "");
}

/** Today as the app shows it, e.g. "10月26日". */
export function todayLabel(now = new Date()): string {
  return `${now.getMonth() + 1}月${now.getDate()}日`;
}
