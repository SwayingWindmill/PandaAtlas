import type { ColumnType } from "kysely";

/**
 * Hand-written for migration 0085. The ask schema holds 问问熊猫 counters and AI Search index
 * bookkeeping only; it is not part of the kysely-codegen run.
 */
export interface AskAccountDailyUsageTable {
  account_id: string;
  usage_on: string;
  question_count: ColumnType<number, number | undefined, number>;
}

export interface AskDailyUsageTable {
  usage_on: string;
  question_count: ColumnType<number, number | undefined, number>;
}

export interface AskIndexItemsTable {
  item_key: string;
  kind: string;
  title_zh: string;
  title_en: string | null;
  app_path: string;
  sources: ColumnType<unknown, string, string>;
  content_sha256: string;
  item_id: string | null;
  uploaded_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface AskIndexStateTable {
  state_id: ColumnType<number, number | undefined, number>;
  fingerprint: string;
  synced_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface DB {
  "ask.account_daily_usage": AskAccountDailyUsageTable;
  "ask.daily_usage": AskDailyUsageTable;
  "ask.index_items": AskIndexItemsTable;
  "ask.index_state": AskIndexStateTable;
}
