import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { findBrokenDocReferences } from "../check-doc-references.mjs";

async function brokenReferencesIn(files) {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-doc-references-"));
  try {
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
      await writeFile(path.join(cwd, file), content, "utf8");
    }
    return findBrokenDocReferences({ cwd, trackedFiles: Object.keys(files) });
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
}

test("reports a relative link to a missing file with its line", async () => {
  assert.deepEqual(
    await brokenReferencesIn({
      "docs/guide.md": "# Guide\n\nSee [the runbook](runbooks/missing.md) and [status](status.md).\n",
      "docs/status.md": "# Status\n",
    }),
    [{ file: "docs/guide.md", line: 3, reference: "runbooks/missing.md" }],
  );
});

test("reports a backticked repository path that does not exist", async () => {
  assert.deepEqual(
    await brokenReferencesIn({
      "README.md": "Run `scripts/check.mjs`, then read `docs/missing.md`.\n",
      "scripts/check.mjs": "",
      "docs/present.md": "",
    }),
    [{ file: "README.md", line: 1, reference: "docs/missing.md" }],
  );
});

test("checks titled, angle-bracket, reference-style, image and root-absolute targets", async () => {
  assert.deepEqual(
    await brokenReferencesIn({
      "docs/guide.md": [
        '[titled](gone-1.md "Title") [angle](<gone 2.md>) ![image](gone-3.png)',
        "[root](/docs/gone-4.md) [ok](/docs/guide.md) [query](guide.md?plain=1)",
        "",
        "[ref]: gone-5.md",
      ].join("\n"),
    }),
    [
      { file: "docs/guide.md", line: 1, reference: "gone-1.md" },
      { file: "docs/guide.md", line: 1, reference: "gone 2.md" },
      { file: "docs/guide.md", line: 1, reference: "gone-3.png" },
      { file: "docs/guide.md", line: 2, reference: "/docs/gone-4.md" },
      { file: "docs/guide.md", line: 4, reference: "gone-5.md" },
    ],
  );
});

test("ignores external URLs, anchors, placeholders, globs, code blocks and a stray percent sign", async () => {
  assert.deepEqual(
    await brokenReferencesIn({
      "README.md": [
        "[site](https://example.com/x) [mail](mailto:a@b.c) [top](#install) [anchor](docs/a.md#part) [odd](docs/a.md%)",
        "`docs/<name>.md` `docs/*.md` `docs/{a,b}.md` `npm run build` `not-a-top-level/x.md` `scripts/present.mjs:12`",
        "",
        "```bash",
        "node scripts/missing.mjs `scripts/missing.mjs` [x](docs/missing.md)",
        "```",
        "",
        "~~~",
        "```",
        "[still code](docs/missing.md)",
        "~~~",
        "",
        "    indented code `scripts/missing.mjs` [x](docs/missing.md)",
      ].join("\n"),
      "docs/a.md": "",
      "scripts/present.mjs": "",
    }),
    [{ file: "README.md", line: 1, reference: "docs/a.md%" }],
  );
});

test("a path the tracked .gitignore files ignore is a local-state location, not a broken reference", async () => {
  assert.deepEqual(
    await brokenReferencesIn({
      ".gitignore": "data/curation/media-inbox/\n",
      "services/api/.gitignore": "dist/\n",
      "docs/photos.md": "Use `data/curation/media-inbox/` and `services/api/dist/`, not `data/curation/missing.csv`.\n",
      "data/curation/a.csv": "",
      "services/api/package.json": "{}",
    }),
    [{ file: "docs/photos.md", line: 1, reference: "data/curation/missing.csv" }],
  );
});

test("a directory-only ignore rule never hides a missing file", async () => {
  assert.deepEqual(
    await brokenReferencesIn({ ".gitignore": "missing.md/\n", "README.md": "See [x](docs/missing.md).\n", "docs/a.md": "" }),
    [{ file: "README.md", line: 1, reference: "docs/missing.md" }],
  );
});

test("checks links but not backticked paths in ADRs, which record past decisions", async () => {
  assert.deepEqual(
    await brokenReferencesIn({
      "docs/architecture/adr-0001-example.md": "Then enforced by `scripts/retired.mjs`; see [gone](gone.md).\n",
      "scripts/present.mjs": "",
    }),
    [{ file: "docs/architecture/adr-0001-example.md", line: 1, reference: "gone.md" }],
  );
});

test("does not check vendored agent skills", async () => {
  assert.deepEqual(
    await brokenReferencesIn({ ".agents/skills/x/SKILL.md": "See [missing](missing.md) and `docs/missing.md`.\n", "docs/a.md": "" }),
    [],
  );
});
