import { describe, expect, it } from "vitest";

import { isAppleCancelError, resolveAuthProvider } from "./apple-provider";

describe("Apple auth helpers", () => {
  it("detects Apple sign-in from app_metadata or linked identities", () => {
    expect(resolveAuthProvider({ app_metadata: { provider: "apple" }, identities: [] })).toBe("apple");
    expect(
      resolveAuthProvider({
        app_metadata: { provider: "email" },
        identities: [{ provider: "email" }, { provider: "apple" }],
      }),
    ).toBe("apple");
    expect(resolveAuthProvider({ app_metadata: { provider: "email" }, identities: [{ provider: "email" }] })).toBe("email");
    expect(resolveAuthProvider({ app_metadata: {}, identities: [] })).toBe("other");
    expect(resolveAuthProvider(null)).toBe("other");
  });

  it("identifies native Apple cancellation errors without swallowing real failures", () => {
    expect(isAppleCancelError({ code: "ERR_REQUEST_CANCELED" })).toBe(true);
    expect(isAppleCancelError({ code: "ERR_REQUEST_FAILED" })).toBe(false);
    expect(isAppleCancelError(new Error("boom"))).toBe(false);
    expect(isAppleCancelError(null)).toBe(false);
  });
});
