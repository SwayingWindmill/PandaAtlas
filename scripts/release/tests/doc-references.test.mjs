import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { findBrokenDocReferences } from "../check-doc-references.mjs";

async function withRepository(files, run) {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-doc-references-"));
  try {
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
      await writeFile(path.join(cwd, file), content, "utf8");
    }
    await run(cwd, Object.keys(files));
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
}

test("reports a relative link to a missing file with its line", async () => {
  await withRepository(
    {
      "docs/guide.md": "# Guide\n\nSee [the runbook](runbooks/missing.md) and [status](status.md).\n",
      "docs/status.md": "# Status\n",
    },
    async (cwd, trackedFiles) => {
      assert.deepEqual(findBrokenDocReferences({ cwd, trackedFiles, isIgnored: () => false }), [
        { file: "docs/guide.md", line: 3, reference: "runbooks/missing.md" },
      ]);
    },
  );
});

test("reports a backticked repository path that does not exist", async () => {
  await withRepository(
    {
      "README.md": "Run `scripts/check.mjs`, then read `docs/missing.md`.\n",
      "scripts/check.mjs": "",
      "docs/present.md": "",
    },
    async (cwd, trackedFiles) => {
      assert.deepEqual(findBrokenDocReferences({ cwd, trackedFiles, isIgnored: () => false }), [
        { file: "README.md", line: 1, reference: "docs/missing.md" },
      ]);
    },
  );
});

test("ignores external URLs, anchors, placeholders, globs and code blocks", async () => {
  await withRepository(
    {
      "README.md": [
        "[site](https://example.com/x) [mail](mailto:a@b.c) [top](#install) [anchor](docs/a.md#part)",
        "`docs/<name>.md` `docs/*.md` `docs/{a,b}.md` `npm run build` `not-a-top-level/x.md`",
        "```bash",
        "node scripts/missing.mjs `scripts/missing.mjs` [x](docs/missing.md)",
        "```",
      ].join("\n"),
      "docs/a.md": "",
      "scripts/present.mjs": "",
    },
    async (cwd, trackedFiles) => {
      assert.deepEqual(findBrokenDocReferences({ cwd, trackedFiles, isIgnored: () => false }), []);
    },
  );
});

test("skips paths Git ignores, which are documented local-state locations", async () => {
  await withRepository(
    { "docs/photos.md": "Place files below `data/curation/media-inbox/`.\n", "data/curation/a.csv": "" },
    async (cwd, trackedFiles) => {
      const isIgnored = (repositoryPath) => repositoryPath.startsWith("data/curation/media-inbox");
      assert.deepEqual(findBrokenDocReferences({ cwd, trackedFiles, isIgnored }), []);
    },
  );
});

test("asks Git which missing paths are ignored, including directory rules", async () => {
  await withRepository(
    {
      ".gitignore": "data/curation/media-inbox/\n",
      "docs/photos.md": "Place files below `data/curation/media-inbox/`, not `data/curation/missing.csv`.\n",
      "data/curation/a.csv": "",
    },
    async (cwd, trackedFiles) => {
      execFileSync("git", ["init", "--quiet"], { cwd });
      assert.deepEqual(findBrokenDocReferences({ cwd, trackedFiles }), [
        { file: "docs/photos.md", line: 1, reference: "data/curation/missing.csv" },
      ]);
    },
  );
});

test("checks links but not backticked paths in ADRs, which record past decisions", async () => {
  await withRepository(
    {
      "docs/architecture/adr-0001-example.md": "Then enforced by `scripts/retired.mjs`; see [gone](gone.md).\n",
      "scripts/present.mjs": "",
    },
    async (cwd, trackedFiles) => {
      assert.deepEqual(findBrokenDocReferences({ cwd, trackedFiles, isIgnored: () => false }), [
        { file: "docs/architecture/adr-0001-example.md", line: 1, reference: "gone.md" },
      ]);
    },
  );
});

test("does not check vendored agent skills", async () => {
  await withRepository(
    { ".agents/skills/x/SKILL.md": "See [missing](missing.md) and `docs/missing.md`.\n", "docs/a.md": "" },
    async (cwd, trackedFiles) => {
      assert.deepEqual(findBrokenDocReferences({ cwd, trackedFiles, isIgnored: () => false }), []);
    },
  );
});
