import { describe, expect, it } from "vitest";
import { authUserAlreadyGone } from "../src/modules/identity/application/auth-user-deletion.js";
import {
  contributorSubjectHash,
  deidentifiedSubjectHash,
} from "../src/modules/contribution/application/contribution-erasure.js";

describe("contribution erasure", () => {
  it("replaces the account hash with one that cannot be tied back to the account", () => {
    const accountId = "55555555-5555-4555-8555-555555555555";
    const submissionId = "66666666-6666-4666-8666-666666666666";
    const tombstone = deidentifiedSubjectHash(submissionId);
    expect(tombstone).toMatch(/^[0-9a-f]{64}$/);
    expect(tombstone).not.toBe(contributorSubjectHash(accountId));
    expect(deidentifiedSubjectHash(submissionId)).toBe(tombstone);
  });
});

describe("auth user deletion", () => {
  it("treats a missing auth user as already deleted", () => {
    expect(authUserAlreadyGone({ status: 404, code: "user_not_found" })).toBe(true);
    expect(authUserAlreadyGone({ status: 404 })).toBe(true);
    expect(authUserAlreadyGone({ code: "user_not_found" })).toBe(true);
    expect(authUserAlreadyGone({ status: 500, code: "unexpected_failure" })).toBe(false);
  });
});
