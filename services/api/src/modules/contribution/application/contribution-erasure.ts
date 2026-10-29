import { createHash } from "node:crypto";

/** sha256 of the account id, the link stored on a submission and its status events. */
export function contributorSubjectHash(accountId: string): string {
  return createHash("sha256").update(accountId).digest("hex");
}

/**
 * A hash that replaces the contributor's hash after deletion.
 * It is derived from the submission id, not the account, so the review record cannot be tied back to the person.
 */
export function deidentifiedSubjectHash(submissionId: string): string {
  return createHash("sha256").update(`deidentified:${submissionId}`).digest("hex");
}
