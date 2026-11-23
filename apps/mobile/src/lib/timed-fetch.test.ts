import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { timedFetch } from "./timed-fetch";

/** A network that answers only when `answer` is called, and honours abort like fetch does. */
function stalledNetwork() {
  let answer: (() => void) | undefined;
  const fetch = vi.fn((_input: Request, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      answer = () => resolve(new Response("{}"));
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    }),
  );
  return { fetch, answer: () => answer?.() };
}

describe("timedFetch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gives up on a request the network never answers", async () => {
    const network = stalledNetwork();
    vi.stubGlobal("fetch", network.fetch);
    const pending = timedFetch(new Request("https://api.example.test/api/v2/pandas"), 1000);
    const outcome = expect(pending).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(1000);
    await outcome;
  });

  it("returns an answer that arrives in time", async () => {
    const network = stalledNetwork();
    vi.stubGlobal("fetch", network.fetch);
    const pending = timedFetch(new Request("https://api.example.test/api/v2/pandas"), 1000);
    await vi.advanceTimersByTimeAsync(500);
    network.answer();
    await expect(pending).resolves.toBeInstanceOf(Response);
  });

  it("still ends when the caller cancels", async () => {
    const network = stalledNetwork();
    vi.stubGlobal("fetch", network.fetch);
    const caller = new AbortController();
    const pending = timedFetch(new Request("https://api.example.test/api/v2/pandas", { signal: caller.signal }), 60_000);
    const outcome = expect(pending).rejects.toThrow("left the screen");
    caller.abort(new Error("left the screen"));
    await outcome;
  });
});
