import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

// A pull request may build on at most one open parent PR, and that parent must target the
// default branch. Deeper stacks keep finished issues out of main; merge the parent first.
export function evaluatePrStack({ baseRef, defaultBranch, findOpenPrByHead }) {
  if (baseRef === defaultBranch) return { ok: true, reason: `targets ${defaultBranch}` };

  const parent = findOpenPrByHead(baseRef);
  if (!parent) return { ok: true, reason: `base ${baseRef} is not an open pull request branch` };
  if (parent.baseRefName === defaultBranch) {
    return { ok: true, reason: `stacked on #${parent.number}, which targets ${defaultBranch}` };
  }

  return {
    ok: false,
    reason:
      `stacked on #${parent.number}, which itself targets ${parent.baseRefName} instead of ${defaultBranch}. ` +
      `Merge #${parent.number} (and its parents) into ${defaultBranch} first, or retarget this pull request to ${defaultBranch}.`,
  };
}

function findOpenPrByHeadWithGh(repository) {
  return (headRef) => {
    const result = spawnSync(
      "gh",
      ["pr", "list", "--repo", repository, "--state", "open", "--head", headRef, "--json", "number,baseRefName"],
      { encoding: "utf8", windowsHide: true },
    );
    if (result.error) throw new Error(`Unable to run gh: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`gh pr list failed: ${(result.stderr ?? "").trim()}`);
    return JSON.parse(result.stdout || "[]")[0] ?? null;
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { BASE_REF: baseRef, DEFAULT_BRANCH: defaultBranch, GITHUB_REPOSITORY: repository } = process.env;
    if (!baseRef || !defaultBranch || !repository) {
      throw new Error("BASE_REF, DEFAULT_BRANCH and GITHUB_REPOSITORY are required.");
    }
    const outcome = evaluatePrStack({
      baseRef,
      defaultBranch,
      findOpenPrByHead: findOpenPrByHeadWithGh(repository),
    });
    if (outcome.ok) {
      console.log(`[pr-stack-depth] passed: ${outcome.reason}`);
    } else {
      console.error(`[pr-stack-depth] failed: ${outcome.reason}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
