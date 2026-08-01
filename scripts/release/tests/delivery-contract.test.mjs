import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkDeliveryContract,
  extractClosingReferences,
  parseBranchName,
  parseWorktreeName,
  validateDeliveryContractShape,
  validateDeliveryRepository,
  validateDeliveryWorkflow,
  validateLocalDeliveryContext,
  validatePullRequestContext,
  validateRemoteDelivery,
} from "../check-delivery-contract.mjs";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const contractPath = path.join(repoRoot, "contracts", "delivery-workflow.v1.json");
const contract = JSON.parse(await readFile(contractPath, "utf8"));

function cloneContract() {
  return structuredClone(contract);
}

function validBody({ issue = 270, slug = "delivery-contract" } = {}) {
  return `## Issue

Closes #${issue}

Worktree: \`.worktrees/issue-${issue}-${slug}\`

## Summary

- Enforce one accountable delivery chain.

## Verification

- Delivery contract tests passed.

## Safety

- No production, data, secret, deployment, DNS, or release action was performed.
`;
}

function validContext(overrides = {}) {
  return {
    number: 271,
    title: "Enforce delivery contracts",
    body: validBody(),
    draft: false,
    baseRef: "master",
    headRef: "chore/issue-270-delivery-contract",
    baseRepository: "SwayingWindmill/ZhiPanda",
    headRepository: "SwayingWindmill/ZhiPanda",
    repository: "SwayingWindmill/ZhiPanda",
    ...overrides,
  };
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    async text() {
      return JSON.stringify(payload);
    },
  };
}

test("tracked delivery files satisfy the repository contract", async () => {
  assert.deepEqual(validateDeliveryContractShape(contract), []);
  assert.deepEqual(validateDeliveryRepository({ repositoryRoot: repoRoot, contract }), []);
  const report = await checkDeliveryContract({
    mode: "repository",
    repositoryRoot: repoRoot,
    quiet: true,
  });
  assert.equal(report.mode, "repository");
});

test("branch and worktree naming parse the same issue and slug", () => {
  const branch = parseBranchName("feat/issue-42-public-map", contract);
  const worktree = parseWorktreeName("issue-42-public-map", contract);
  assert.deepEqual(branch.violations, []);
  assert.deepEqual(worktree.violations, []);
  assert.equal(branch.issue, 42);
  assert.equal(branch.slug, "public-map");
  assert.equal(worktree.issue, branch.issue);
  assert.equal(worktree.slug, branch.slug);
});

test("branch policy rejects protected, malformed, and excessive names", () => {
  assert.ok(parseBranchName("master", contract).violations.length > 0);
  assert.ok(parseBranchName("feature/issue-1-wrong-type", contract).violations.length > 0);
  assert.ok(parseBranchName("feat/no-issue", contract).violations.length > 0);
  assert.ok(
    parseBranchName(`feat/issue-1-${"a".repeat(100)}`, contract).violations.some((item) =>
      item.includes("maximum length"),
    ),
  );
});

test("local delivery context rejects worktree mismatch and unregistered paths", () => {
  const result = validateLocalDeliveryContext(
    {
      repositoryRoot: "C:/repo/.worktrees/issue-271-other-slug",
      branch: "chore/issue-270-delivery-contract",
      worktrees: [],
    },
    contract,
  );
  assert.ok(result.violations.some((item) => item.includes("branch issue 270")));
  assert.ok(result.violations.some((item) => item.includes("branch slug delivery-contract")));
  assert.ok(result.violations.some((item) => item.includes("not registered as a Git worktree")));
});

test("valid pull-request metadata passes", () => {
  const result = validatePullRequestContext(validContext(), contract);
  assert.deepEqual(result.violations, []);
  assert.equal(result.issue, 270);
  assert.equal(result.slug, "delivery-contract");
  assert.equal(result.closingReferences.length, 1);
});

test("pull-request metadata rejects stacked bases, forks, and protected heads", () => {
  const stacked = validatePullRequestContext(validContext({ baseRef: "other-branch" }), contract);
  assert.ok(stacked.violations.some((item) => item.includes("must target master")));

  const fork = validatePullRequestContext(
    validContext({ headRepository: "contributor/ZhiPanda" }),
    contract,
  );
  assert.ok(fork.violations.some((item) => item.includes("fork pull requests are not allowed")));

  const protectedHead = validatePullRequestContext(
    validContext({ headRef: "master" }),
    contract,
  );
  assert.ok(protectedHead.violations.some((item) => item.includes("protected branch")));
});

test("pull-request body rejects placeholders, missing sections, and duplicate sections", async () => {
  const placeholder = validatePullRequestContext(
    validContext({ body: await readFile(path.join(repoRoot, ".github", "PULL_REQUEST_TEMPLATE.md"), "utf8") }),
    contract,
  );
  assert.ok(placeholder.violations.some((item) => item.includes("exactly one closing reference")));
  assert.ok(placeholder.violations.some((item) => item.includes("concrete content")));

  const missing = validatePullRequestContext(
    validContext({ body: "## Issue\n\nCloses #270" }),
    contract,
  );
  assert.ok(missing.violations.includes("pull-request body is missing section: Summary"));

  const duplicate = validatePullRequestContext(
    validContext({ body: `${validBody()}\n## Safety\n\n- Duplicate.\n` }),
    contract,
  );
  assert.ok(duplicate.violations.includes("pull-request body repeats section: Safety"));
});

test("closing references reject multiple issues, mismatches, and cross-repository syntax", () => {
  const multipleBody = validBody().replace(
    "Closes #270",
    "Closes #270\n\nFixes #271",
  );
  const multiple = validatePullRequestContext(validContext({ body: multipleBody }), contract);
  assert.ok(
    multiple.violations.includes(
      "pull-request body must contain exactly one closing reference: found 2",
    ),
  );

  const mismatch = validatePullRequestContext(
    validContext({ body: validBody().replace("Closes #270", "Closes #271") }),
    contract,
  );
  assert.ok(mismatch.violations.some((item) => item.includes("does not match branch issue")));

  const crossRepositoryBody = validBody().replace(
    "Closes #270",
    "Closes other/repository#270",
  );
  const crossRepository = validatePullRequestContext(
    validContext({ body: crossRepositoryBody }),
    contract,
  );
  assert.ok(
    crossRepository.violations.some((item) => item.includes("cross-repository closing reference")),
  );
  assert.equal(extractClosingReferences(crossRepositoryBody, contract).length, 1);
});

test("delivery workflow rejects write permission, unsafe trigger, and mutation commands", async () => {
  const workflow = await readFile(
    path.join(repoRoot, ".github", "workflows", "delivery-contract.yml"),
    "utf8",
  );
  assert.deepEqual(validateDeliveryWorkflow(workflow), []);
  const unsafe = workflow
    .replace("issues: read", "issues: write")
    .replace("  pull_request:", "  pull_request_target:")
    .concat("\n      - run: git push origin HEAD\n");
  const violations = validateDeliveryWorkflow(unsafe);
  assert.ok(violations.includes("delivery workflow must not request write permissions"));
  assert.ok(violations.includes("delivery workflow must not use trigger: pull_request_target"));
  assert.ok(violations.includes("delivery workflow contains forbidden mutation command: git push"));
});

test("remote validation accepts an open Issue and only the current pull request", async () => {
  const context = validContext();
  const metadata = validatePullRequestContext(context, contract);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("/issues/270")) return response({ number: 270, state: "open" });
    return response([
      {
        number: 271,
        body: context.body,
        head: { ref: context.headRef, repo: { full_name: context.headRepository } },
      },
    ]);
  };
  assert.deepEqual(
    await validateRemoteDelivery({
      context,
      metadata,
      contract,
      token: "test-token",
      fetchImpl,
    }),
    [],
  );
  assert.equal(calls.length, 2);
});

test("remote validation rejects closed Issues, pull-request objects, and duplicate deliveries", async () => {
  const context = validContext();
  const metadata = validatePullRequestContext(context, contract);
  const fetchImpl = async (url) => {
    if (url.includes("/issues/270")) {
      return response({ number: 270, state: "closed", pull_request: { url: "example" } });
    }
    return response([
      {
        number: 999,
        body: validBody(),
        head: { ref: context.headRef, repo: { full_name: context.headRepository } },
      },
    ]);
  };
  const violations = await validateRemoteDelivery({
    context,
    metadata,
    contract,
    token: "test-token",
    fetchImpl,
  });
  assert.ok(violations.includes("referenced object #270 is a pull request, not an Issue"));
  assert.ok(violations.includes("referenced Issue #270 is not open: closed"));
  assert.ok(violations.includes("another open pull request uses branch chore/issue-270-delivery-contract: #999"));
  assert.ok(violations.includes("another open pull request closes Issue #270: #999"));
});

test("event mode validates a synthetic GitHub pull-request payload", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "panda-delivery-event-"));
  const eventPath = path.join(directory, "event.json");
  try {
    const context = validContext();
    await writeFile(
      eventPath,
      JSON.stringify({
        number: context.number,
        repository: { full_name: context.repository },
        pull_request: {
          number: context.number,
          title: context.title,
          body: context.body,
          draft: context.draft,
          base: {
            ref: context.baseRef,
            repo: { full_name: context.baseRepository },
          },
          head: {
            ref: context.headRef,
            repo: { full_name: context.headRepository },
          },
        },
      }),
      "utf8",
    );
    const report = await checkDeliveryContract({
      mode: "event",
      repositoryRoot: repoRoot,
      eventPath,
      quiet: true,
    });
    assert.equal(report.issue, 270);
    assert.equal(report.branch, "chore/issue-270-delivery-contract");
    assert.equal(report.worktree, ".worktrees/issue-270-delivery-contract");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("contract shape fails closed for unknown keys and missing canonical placeholders", () => {
  const changed = cloneContract();
  changed.unknown = true;
  changed.pull_request.canonical_worktree_line = "Worktree missing variables";
  const violations = validateDeliveryContractShape(changed);
  assert.ok(violations.includes("contract contains unknown field: unknown"));
  assert.ok(
    violations.includes(
      "pull_request.canonical_worktree_line must include {issue} and {slug}",
    ),
  );
});
