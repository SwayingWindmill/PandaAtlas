import { describe, expect, it, vi } from "vitest";

import { sentryEnvelope, sentryTarget } from "./error-reporting";

vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "1.2.3" } } }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "00000000-0000-0000-0000-000000000000" }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.stubGlobal("__DEV__", false);

describe("sentryTarget", () => {
  it("is null without a DSN, so local and e2e runs send nothing", () => {
    expect(sentryTarget(undefined)).toBeNull();
    expect(sentryTarget("")).toBeNull();
  });

  it("is null for a value that is not a DSN", () => {
    expect(sentryTarget("not a url")).toBeNull();
    expect(sentryTarget("https://o1.ingest.sentry.io/123")).toBeNull();
    expect(sentryTarget("https://key@o1.ingest.sentry.io/")).toBeNull();
  });

  it("builds the envelope URL from the DSN's key, host and project", () => {
    expect(sentryTarget("https://abc123@o1.ingest.sentry.io/4507")?.url).toBe(
      "https://o1.ingest.sentry.io/api/4507/envelope/?sentry_key=abc123&sentry_version=7",
    );
  });
});

describe("sentryEnvelope", () => {
  const meta = {
    dsn: "https://abc123@o1.ingest.sentry.io/4507",
    eventId: "e1",
    now: new Date("2026-11-22T00:00:00Z"),
    release: "zhipanda-mobile@1.2.3",
    os: "ios",
  };

  it("carries the header, the item type and the event, one JSON per line", () => {
    const [header, item, event] = sentryEnvelope(new TypeError("boom"), { ...meta, source: "error-boundary" })
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(header).toEqual({ event_id: "e1", dsn: meta.dsn, sent_at: "2026-11-22T00:00:00.000Z" });
    expect(item).toEqual({ type: "event" });
    expect(event).toMatchObject({
      event_id: "e1",
      level: "error",
      release: "zhipanda-mobile@1.2.3",
      environment: "production",
      tags: { source: "error-boundary", os: "ios" },
      exception: { values: [{ type: "TypeError", value: "boom" }] },
    });
  });

  it("marks a fatal error fatal and reports a thrown non-Error by its text", () => {
    const event = JSON.parse(sentryEnvelope("plain string", { ...meta, source: "fatal" }).split("\n")[2]!);
    expect(event.level).toBe("fatal");
    expect(event.exception.values[0]).toEqual({ type: "Error", value: "plain string" });
  });
});
