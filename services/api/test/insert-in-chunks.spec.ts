import { describe, expect, it } from "vitest";
import {
  MAX_BIND_PARAMETERS,
  insertInChunks,
} from "../src/modules/publication/infrastructure/postgres-publication.coordinator.js";

function rows(count: number, columns: number): Record<string, number>[] {
  return Array.from({ length: count }, (_, row) =>
    Object.fromEntries(Array.from({ length: columns }, (_, column) => [`c${column}`, row])));
}

describe("insertInChunks", () => {
  it("keeps every batch under the bind limit and every row, in order", async () => {
    const chunks: Record<string, number>[][] = [];
    // Production's evidence sources at the time of the failed build.
    const evidence = rows(6_461, 11);
    await insertInChunks(evidence, (chunk) => {
      chunks.push(chunk);
      return Promise.resolve();
    });
    expect(chunks.length).toBe(2);
    expect(chunks.every((chunk) => chunk.length * 11 <= MAX_BIND_PARAMETERS)).toBe(true);
    expect(chunks.flat()).toEqual(evidence);
  });

  it("inserts a small set in one statement and nothing for an empty one", async () => {
    const calls: number[] = [];
    const record = (chunk: unknown[]) => {
      calls.push(chunk.length);
      return Promise.resolve();
    };
    await insertInChunks(rows(12, 7), record);
    await insertInChunks([], record);
    expect(calls).toEqual([12]);
  });
});
