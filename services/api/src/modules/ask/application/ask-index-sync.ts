import { createHash } from "node:crypto";
import type { AskIndexedDocument } from "./ask-corpus.js";
import type { AskCorpusSource, AskIndexRepository, AskSearchIndex } from "./ask.ports.js";

/**
 * AI Search writes allowed in one scheduled cycle. A Workers Free invocation may make 50
 * subrequests; the cycle's other stages need some, so the index converges over several cycles.
 */
export const ASK_SYNC_WRITES_PER_CYCLE = 20;

export interface AskIndexSyncResult {
  status: "current" | "partial" | "complete";
  uploaded: number;
  deleted: number;
  pending: number;
}

/** Changes whenever a passage is added, removed or edited. */
export function corpusFingerprint(documents: AskIndexedDocument[]): string {
  const lines = documents.map((document) => `${document.key} ${document.contentSha256}`).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export class AskIndexSync {
  public constructor(
    private readonly corpus: AskCorpusSource,
    private readonly repository: AskIndexRepository,
    private readonly writesPerCycle = ASK_SYNC_WRITES_PER_CYCLE,
  ) {}

  public async run(index: AskSearchIndex): Promise<AskIndexSyncResult> {
    // Building the corpus is a handful of reads; comparing its hash skips every write when nothing changed.
    const documents = await this.corpus.documents();
    const fingerprint = corpusFingerprint(documents);
    if ((await this.repository.fingerprint()) === fingerprint) {
      return { status: "current", uploaded: 0, deleted: 0, pending: 0 };
    }
    const wanted = new Map(documents.map((document) => [document.key, document]));
    const rows = new Map((await this.repository.all()).map((row) => [row.itemKey, row]));
    const stale = [...rows.values()].filter((row) => !wanted.has(row.itemKey));
    const changed = documents.filter((document) => {
      const row = rows.get(document.key);
      return row === undefined || !row.uploaded || row.contentSha256 !== document.contentSha256;
    });

    let writes = 0;
    let deleted = 0;
    let uploaded = 0;
    // Unpublished entries leave the index first, so search never returns something no longer public.
    for (const row of stale) {
      if (writes >= this.writesPerCycle) break;
      if (row.itemId !== null) {
        await index.delete(row.itemId);
        writes += 1;
      }
      await this.repository.remove(row.itemKey);
      deleted += 1;
    }
    for (const document of changed) {
      if (writes >= this.writesPerCycle) break;
      const previous = rows.get(document.key);
      const { id } = await index.upload(document.key, document.text, {
        kind: document.kind,
        path: document.appPath,
      });
      writes += 1;
      if (previous?.itemId != null && previous.itemId !== id && writes < this.writesPerCycle) {
        await index.delete(previous.itemId);
        writes += 1;
      }
      await this.repository.saveUploaded(document, id);
      uploaded += 1;
    }

    const pending = stale.length - deleted + changed.length - uploaded;
    if (pending === 0) {
      await this.repository.saveFingerprint(fingerprint);
      return { status: "complete", uploaded, deleted, pending };
    }
    return { status: "partial", uploaded, deleted, pending };
  }
}
