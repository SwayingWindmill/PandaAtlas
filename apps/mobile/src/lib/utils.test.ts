import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps the text color next to every design-system text size", () => {
    for (const size of ["display", "title", "headline", "body", "subheadline", "footnote", "reading-body"]) {
      expect(cn("text-body text-foreground", `text-${size}`)).toContain("text-foreground");
    }
  });

  it("lets a later text size replace the earlier one", () => {
    expect(cn("text-headline", "text-subheadline")).toBe("text-subheadline");
  });
});
