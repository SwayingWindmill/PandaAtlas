import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { AskDocumentKind, AskIndexedDocument, AskSourceLink } from "../application/ask-corpus.js";
import type { AskIndexRepository, AskIndexRow } from "../application/ask.ports.js";

interface Row {
  item_key: string;
  kind: string;
  title_zh: string;
  title_en: string | null;
  app_path: string;
  sources: unknown;
  content_sha256: string;
  item_id: string | null;
  uploaded_at: Date | null;
}

const COLUMNS = ["item_key", "kind", "title_zh", "title_en", "app_path", "sources", "content_sha256", "item_id", "uploaded_at"] as const;

function sourcesOf(value: unknown): AskSourceLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) return [];
    const { title, publisher, url } = item as Record<string, unknown>;
    return typeof title === "string" && typeof url === "string"
      ? [{ title, publisher: typeof publisher === "string" ? publisher : null, url }]
      : [];
  });
}

function map(row: Row): AskIndexRow {
  return {
    itemKey: row.item_key,
    kind: row.kind as AskDocumentKind,
    titleZh: row.title_zh,
    titleEn: row.title_en,
    appPath: row.app_path,
    sources: sourcesOf(row.sources),
    contentSha256: row.content_sha256,
    itemId: row.item_id,
    uploaded: row.uploaded_at !== null,
  };
}

/** What is in AI Search and where each passage points in the app. */
export class PostgresAskIndexRepository implements AskIndexRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async uploadedByKeys(keys: string[]): Promise<AskIndexRow[]> {
    if (keys.length === 0) return [];
    const rows = await this.database.db
      .selectFrom("ask.index_items")
      .select(COLUMNS)
      .where("item_key", "in", keys)
      .where("uploaded_at", "is not", null)
      .execute();
    return rows.map(map);
  }

  public async byKinds(kinds: AskDocumentKind[]): Promise<AskIndexRow[]> {
    const rows = await this.database.db
      .selectFrom("ask.index_items")
      .select(COLUMNS)
      .where("kind", "in", kinds)
      .where("uploaded_at", "is not", null)
      .orderBy("item_key")
      .execute();
    return rows.map(map);
  }

  public async all(): Promise<AskIndexRow[]> {
    const rows = await this.database.db.selectFrom("ask.index_items").select(COLUMNS).execute();
    return rows.map(map);
  }

  public async saveUploaded(document: AskIndexedDocument, itemId: string): Promise<void> {
    const values = {
      kind: document.kind,
      title_zh: document.titleZh,
      title_en: document.titleEn,
      app_path: document.appPath,
      sources: JSON.stringify(document.sources),
      content_sha256: document.contentSha256,
      item_id: itemId,
      uploaded_at: new Date(),
      updated_at: new Date(),
    };
    await this.database.db
      .insertInto("ask.index_items")
      .values({ item_key: document.key, ...values })
      .onConflict((conflict) => conflict.column("item_key").doUpdateSet(values))
      .execute();
  }

  public async remove(itemKey: string): Promise<void> {
    await this.database.db.deleteFrom("ask.index_items").where("item_key", "=", itemKey).execute();
  }

  public async fingerprint(): Promise<string | null> {
    const row = await this.database.db.selectFrom("ask.index_state").select("fingerprint").where("state_id", "=", 1).executeTakeFirst();
    return row?.fingerprint ?? null;
  }

  public async saveFingerprint(fingerprint: string): Promise<void> {
    await this.database.db
      .insertInto("ask.index_state")
      .values({ state_id: 1, fingerprint, synced_at: new Date() })
      .onConflict((conflict) => conflict.column("state_id").doUpdateSet({ fingerprint, synced_at: new Date() }))
      .execute();
  }
}
