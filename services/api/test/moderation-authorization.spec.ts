import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES } from "../src/modules/identity/http/access.metadata.js";
import { ModerationController } from "../src/modules/moderation/http/moderation.controller.js";

describe("Moderation route permissions", () => {
  it("uses a read permission for appeal inspection and retains stronger permission for decisions", () => {
    // Nest attaches route metadata to the method function rather than its prototype property.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, ModerationController.prototype.listAppeals)).toEqual([
      "moderation.appeal.read",
    ]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, ModerationController.prototype.decideAppeal)).toEqual([
      "moderation.appeal.decide",
    ]);
  });
});
