import { describe, expect, it } from "vitest";

import { type CorrectionDraft, EMPTY_DRAFT, buildSubmission, draftProblem, statusLabel } from "./correction";

const complete: CorrectionDraft = {
  topic: "birth_date",
  value: " 2020-07-21 ",
  sourceTitle: " 基地公告 ",
  locator: " https://example.org/news/1 ",
};

describe("draftProblem", () => {
  it("names the first missing field in form order", () => {
    expect(draftProblem(EMPTY_DRAFT)).toBe("选一项哪里不对。");
    expect(draftProblem({ ...complete, value: "  " })).toBe("写下正确的内容。");
    expect(draftProblem({ ...complete, sourceTitle: "" })).toBe("写下来源的名称。");
    expect(draftProblem({ ...complete, locator: "" })).toBe("写下来源的链接或出处。");
    expect(draftProblem(complete)).toBeNull();
  });
});

describe("buildSubmission", () => {
  it("sends one trimmed assertion tied to one source, against the release the fan saw", () => {
    expect(buildSubmission(complete, { pandaId: "p1", releaseVersion: "2026.10.26.1" }, "2026-10-26")).toEqual({
      submissionType: "correction",
      targetPandaId: "p1",
      publicVersionSeen: "2026.10.26.1",
      assertions: [
        {
          assertionKey: "assertion-1",
          fieldKey: "birth_date",
          value: "2020-07-21",
          certainty: "provisional",
          lastVerifiedOn: "2026-10-26",
          sourceKeys: ["source-1"],
        },
      ],
      sources: [{ sourceKey: "source-1", sourceKind: "url", title: "基地公告", locator: "https://example.org/news/1" }],
    });
  });

  it("keeps a source that is not a link as other", () => {
    const submission = buildSubmission(
      { ...complete, locator: "《大熊猫谱系》2024 版第 12 页" },
      { pandaId: "p1", releaseVersion: "v" },
      "2026-10-26",
    );
    expect(submission.sources[0]?.sourceKind).toBe("other");
  });
});

describe("statusLabel", () => {
  it("says what happened in the fan's words", () => {
    expect(statusLabel("submitted")).toBe("等待审核");
    expect(statusLabel("not_accepted")).toBe("未采纳");
  });
});
