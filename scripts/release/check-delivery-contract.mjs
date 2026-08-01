import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const defaultContractPath = path.join(
  repoRoot,
  "contracts",
  "delivery-workflow.v1.json",
);

const CONTRACT_KEYS = new Set([
  "schema_version",
  "title",
  "repository",
  "branch",
  "worktree",
  "pull_request",
  "files",
]);
const REPOSITORY_KEYS = new Set([
  "default_branch",
  "allow_forks",
  "protected_branches",
]);
const BRANCH_KEYS = new Set(["pattern", "types", "maximum_length"]);
const WORKTREE_KEYS = new Set([
  "parent_directory",
  "pattern",
  "require_registered_worktree",
  "require_branch_issue_match",
  "require_branch_slug_match",
]);
const PULL_REQUEST_KEYS = new Set([
  "required_sections",
  "closing_keywords",
  "canonical_issue_line",
  "canonical_worktree_line",
  "require_exactly_one_closing_reference",
  "require_same_repository_issue",
  "require_open_issue",
  "require_unique_open_pull_request",
  "require_nonempty_summary",
  "require_nonempty_verification",
  "require_nonempty_safety",
]);
const FILE_KEYS = new Set([
  "workflow",
  "pull_request_template",
  "issue_template",
  "documentation",
]);
const REQUIRED_WORKFLOW_EVENTS = [
  "opened",
  "edited",
  "synchronize",
  "reopened",
  "ready_for_review",
  "converted_to_draft",
];
const TEMPLATE_PLACEHOLDERS = [
  "ISSUE_NUMBER",
  "delivery-slug",
  "Describe the bounded change delivered by this pull request.",
  "List the commands and acceptance checks that passed.",
  "State explicitly which production, data, secret, deployment, DNS, or release actions were not performed.",
];

export class DeliveryContractError extends Error {
  constructor(violations) {
    const ordered = [...new Set(violations)].sort();
    super(`Delivery contract check failed with ${ordered.length} violation(s)`);
    this.name = "DeliveryContractError";
    this.violations = ordered;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function normalizeRepositoryPath(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/gu, "/");
}

function unknownKeys(value, allowed, label, violations) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`${label} must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) violations.push(`${label} contains unknown field: ${key}`);
  }
}

function validateStringArray(value, label, violations) {
  if (!Array.isArray(value) || value.length === 0) {
    violations.push(`${label} must be a non-empty array`);
    return;
  }
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") {
      violations.push(`${label} values must be non-empty strings`);
      continue;
    }
    if (seen.has(item)) violations.push(`${label} values must be unique: ${item}`);
    seen.add(item);
  }
}

function validateBoolean(value, label, violations) {
  if (typeof value !== "boolean") violations.push(`${label} must be boolean`);
}

function validateRelativePath(value, label, violations) {
  if (typeof value !== "string" || value.trim() === "") {
    violations.push(`${label} must be a non-empty repository-relative path`);
    return;
  }
  const normalized = normalizeRepositoryPath(value);
  if (
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    violations.push(`${label} must stay inside the repository: ${value}`);
  }
}

function compilePattern(pattern, label, violations) {
  if (typeof pattern !== "string" || pattern.trim() === "") {
    violations.push(`${label} must be a non-empty regular expression`);
    return null;
  }
  try {
    return new RegExp(pattern, "u");
  } catch (error) {
    violations.push(`${label} is invalid: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export function validateDeliveryContractShape(contract) {
  const violations = [];
  unknownKeys(contract, CONTRACT_KEYS, "contract", violations);
  if (contract?.schema_version !== 1) violations.push("schema_version must be 1");
  if (typeof contract?.title !== "string" || contract.title.trim() === "") {
    violations.push("title must be a non-empty string");
  }

  unknownKeys(contract?.repository, REPOSITORY_KEYS, "repository", violations);
  if (
    typeof contract?.repository?.default_branch !== "string" ||
    contract.repository.default_branch.trim() === ""
  ) {
    violations.push("repository.default_branch must be a non-empty string");
  }
  validateBoolean(contract?.repository?.allow_forks, "repository.allow_forks", violations);
  validateStringArray(
    contract?.repository?.protected_branches,
    "repository.protected_branches",
    violations,
  );
  if (
    contract?.repository?.default_branch &&
    !contract.repository.protected_branches?.includes(contract.repository.default_branch)
  ) {
    violations.push("repository.default_branch must be protected");
  }

  unknownKeys(contract?.branch, BRANCH_KEYS, "branch", violations);
  const branchPattern = compilePattern(contract?.branch?.pattern, "branch.pattern", violations);
  validateStringArray(contract?.branch?.types, "branch.types", violations);
  if (!Number.isInteger(contract?.branch?.maximum_length) || contract.branch.maximum_length < 20) {
    violations.push("branch.maximum_length must be an integer of at least 20");
  }
  if (branchPattern) {
    for (const branchType of contract?.branch?.types ?? []) {
      const sample = `${branchType}/issue-1-sample`;
      if (!branchPattern.test(sample)) {
        violations.push(`branch.pattern does not accept declared type: ${branchType}`);
      }
    }
  }

  unknownKeys(contract?.worktree, WORKTREE_KEYS, "worktree", violations);
  if (
    typeof contract?.worktree?.parent_directory !== "string" ||
    !/^\.[a-z0-9-]+$/u.test(contract.worktree.parent_directory)
  ) {
    violations.push("worktree.parent_directory must be a dot-prefixed directory name");
  }
  compilePattern(contract?.worktree?.pattern, "worktree.pattern", violations);
  for (const key of [
    "require_registered_worktree",
    "require_branch_issue_match",
    "require_branch_slug_match",
  ]) {
    validateBoolean(contract?.worktree?.[key], `worktree.${key}`, violations);
  }

  unknownKeys(contract?.pull_request, PULL_REQUEST_KEYS, "pull_request", violations);
  validateStringArray(
    contract?.pull_request?.required_sections,
    "pull_request.required_sections",
    violations,
  );
  validateStringArray(
    contract?.pull_request?.closing_keywords,
    "pull_request.closing_keywords",
    violations,
  );
  for (const key of ["canonical_issue_line", "canonical_worktree_line"]) {
    if (
      typeof contract?.pull_request?.[key] !== "string" ||
      contract.pull_request[key].trim() === ""
    ) {
      violations.push(`pull_request.${key} must be a non-empty string`);
    }
  }
  if (!contract?.pull_request?.canonical_issue_line?.includes("{issue}")) {
    violations.push("pull_request.canonical_issue_line must include {issue}");
  }
  if (
    !contract?.pull_request?.canonical_worktree_line?.includes("{issue}") ||
    !contract?.pull_request?.canonical_worktree_line?.includes("{slug}")
  ) {
    violations.push("pull_request.canonical_worktree_line must include {issue} and {slug}");
  }
  for (const key of [
    "require_exactly_one_closing_reference",
    "require_same_repository_issue",
    "require_open_issue",
    "require_unique_open_pull_request",
    "require_nonempty_summary",
    "require_nonempty_verification",
    "require_nonempty_safety",
  ]) {
    validateBoolean(contract?.pull_request?.[key], `pull_request.${key}`, violations);
  }

  unknownKeys(contract?.files, FILE_KEYS, "files", violations);
  for (const key of FILE_KEYS) {
    validateRelativePath(contract?.files?.[key], `files.${key}`, violations);
  }

  return [...new Set(violations)].sort();
}

export function parseBranchName(branchName, contract) {
  const branch = String(branchName ?? "").trim();
  const violations = [];
  if (!branch) return { violations: ["current branch name is empty"] };
  if (branch.length > contract.branch.maximum_length) {
    violations.push(
      `branch exceeds maximum length ${contract.branch.maximum_length}: ${branch.length}`,
    );
  }
  if (contract.repository.protected_branches.includes(branch)) {
    violations.push(`protected branch cannot be used for delivery work: ${branch}`);
  }
  const match = new RegExp(contract.branch.pattern, "u").exec(branch);
  if (!match) {
    violations.push(`branch does not match delivery pattern: ${branch}`);
    return { violations };
  }
  const [, type, issueText, slug] = match;
  if (!contract.branch.types.includes(type)) {
    violations.push(`branch type is not allowed: ${type}`);
  }
  return {
    type,
    issue: Number(issueText),
    slug,
    branch,
    violations,
  };
}

export function parseWorktreeName(worktreeName, contract) {
  const name = String(worktreeName ?? "").trim();
  const match = new RegExp(contract.worktree.pattern, "u").exec(name);
  if (!match) {
    return { violations: [`worktree name does not match delivery pattern: ${name || "<empty>"}`] };
  }
  const [, issueText, slug] = match;
  return { issue: Number(issueText), slug, name, violations: [] };
}

function runGit(args, { cwd }) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw new Error(`git ${args.join(" ")} failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed with code ${result.status}: ${(result.stderr ?? "").trim()}`,
    );
  }
  return String(result.stdout ?? "").trim();
}

export function parseWorktreePorcelain(contents) {
  const entries = [];
  let current = null;
  for (const line of String(contents ?? "").split(/\r?\n/u)) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice("worktree ".length) };
    } else if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length);
    } else if (current && line === "bare") {
      current.bare = true;
    } else if (current && line === "detached") {
      current.detached = true;
    }
  }
  if (current) entries.push(current);
  return entries;
}

export function readLocalDeliveryContext({ cwd = process.cwd() } = {}) {
  const repositoryRoot = runGit(["rev-parse", "--show-toplevel"], { cwd });
  const branch = runGit(["branch", "--show-current"], { cwd: repositoryRoot });
  const worktrees = parseWorktreePorcelain(
    runGit(["worktree", "list", "--porcelain"], { cwd: repositoryRoot }),
  );
  return { repositoryRoot, branch, worktrees };
}

function sameFilesystemPath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

export function validateLocalDeliveryContext(context, contract) {
  const violations = [];
  const branchMetadata = parseBranchName(context.branch, contract);
  violations.push(...branchMetadata.violations);

  const repositoryRoot = path.resolve(context.repositoryRoot);
  const worktreeName = path.basename(repositoryRoot);
  const parentName = path.basename(path.dirname(repositoryRoot));
  if (parentName !== contract.worktree.parent_directory) {
    violations.push(
      `worktree parent must be ${contract.worktree.parent_directory}: ${path.dirname(repositoryRoot)}`,
    );
  }
  const worktreeMetadata = parseWorktreeName(worktreeName, contract);
  violations.push(...worktreeMetadata.violations);

  if (branchMetadata.issue && worktreeMetadata.issue) {
    if (
      contract.worktree.require_branch_issue_match &&
      branchMetadata.issue !== worktreeMetadata.issue
    ) {
      violations.push(
        `branch issue ${branchMetadata.issue} does not match worktree issue ${worktreeMetadata.issue}`,
      );
    }
    if (
      contract.worktree.require_branch_slug_match &&
      branchMetadata.slug !== worktreeMetadata.slug
    ) {
      violations.push(
        `branch slug ${branchMetadata.slug} does not match worktree slug ${worktreeMetadata.slug}`,
      );
    }
  }

  if (contract.worktree.require_registered_worktree) {
    const registered = context.worktrees.find((entry) =>
      sameFilesystemPath(entry.path, repositoryRoot),
    );
    if (!registered) {
      violations.push(`current path is not registered as a Git worktree: ${repositoryRoot}`);
    } else {
      const expectedBranch = `refs/heads/${context.branch}`;
      if (registered.branch !== expectedBranch) {
        violations.push(
          `registered worktree branch mismatch: expected ${expectedBranch}, received ${registered.branch ?? "<missing>"}`,
        );
      }
      if (registered.bare || registered.detached) {
        violations.push("delivery worktree must not be bare or detached");
      }
    }
  }

  return {
    branch: branchMetadata,
    worktree: worktreeMetadata,
    violations: [...new Set(violations)].sort(),
  };
}

export function extractMarkdownSections(body) {
  const text = String(body ?? "").replaceAll("\r\n", "\n");
  const headingPattern = /^##\s+(.+?)\s*$/gmu;
  const headings = [...text.matchAll(headingPattern)].map((match) => ({
    title: match[1].trim(),
    index: match.index ?? 0,
    contentStart: (match.index ?? 0) + match[0].length,
  }));
  const sections = new Map();
  const duplicates = new Set();
  for (const [index, heading] of headings.entries()) {
    const next = headings[index + 1];
    const content = text.slice(heading.contentStart, next?.index ?? text.length).trim();
    if (sections.has(heading.title)) duplicates.add(heading.title);
    else sections.set(heading.title, content);
  }
  return { sections, duplicates: [...duplicates].sort(), headings };
}

export function extractClosingReferences(body, contract) {
  const keywords = [...contract.pull_request.closing_keywords]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(
    `\\b(?<keyword>${keywords})\\s*:?\\s+(?:(?<owner>[A-Za-z0-9_.-]+)/(?<repo>[A-Za-z0-9_.-]+))?#(?<issue>[1-9][0-9]*)\\b`,
    "giu",
  );
  return [...String(body ?? "").matchAll(pattern)].map((match) => ({
    keyword: match.groups?.keyword?.toLowerCase(),
    owner: match.groups?.owner ?? null,
    repo: match.groups?.repo ?? null,
    issue: Number(match.groups?.issue),
    text: match[0],
    index: match.index ?? 0,
  }));
}

function canonicalIssueLine(contract, issue) {
  return contract.pull_request.canonical_issue_line.replace("{issue}", String(issue));
}

function canonicalWorktreeLine(contract, issue, slug) {
  return contract.pull_request.canonical_worktree_line
    .replace("{issue}", String(issue))
    .replace("{slug}", slug);
}

function meaningfulSectionContent(content) {
  const normalized = String(content ?? "")
    .replace(/<!--.*?-->/gsu, "")
    .replace(/^[-*+]\s*/gmu, "")
    .trim();
  if (!normalized) return false;
  return !TEMPLATE_PLACEHOLDERS.some((placeholder) => normalized.includes(placeholder));
}

export function validatePullRequestContext(context, contract) {
  const violations = [];
  if (!context || typeof context !== "object") {
    return { violations: ["pull-request context must be an object"] };
  }
  if (context.baseRef !== contract.repository.default_branch) {
    violations.push(
      `pull request must target ${contract.repository.default_branch}: ${context.baseRef ?? "<missing>"}`,
    );
  }
  if (contract.repository.protected_branches.includes(context.headRef)) {
    violations.push(`pull-request head cannot be protected branch: ${context.headRef}`);
  }
  if (
    !contract.repository.allow_forks &&
    context.headRepository &&
    context.baseRepository &&
    context.headRepository !== context.baseRepository
  ) {
    violations.push(
      `fork pull requests are not allowed: ${context.headRepository} -> ${context.baseRepository}`,
    );
  }

  const branchMetadata = parseBranchName(context.headRef, contract);
  violations.push(...branchMetadata.violations);
  const body = String(context.body ?? "");
  const { sections, duplicates } = extractMarkdownSections(body);
  for (const section of contract.pull_request.required_sections) {
    if (!sections.has(section)) violations.push(`pull-request body is missing section: ${section}`);
  }
  for (const duplicate of duplicates) {
    if (contract.pull_request.required_sections.includes(duplicate)) {
      violations.push(`pull-request body repeats section: ${duplicate}`);
    }
  }

  const closingReferences = extractClosingReferences(body, contract);
  if (
    contract.pull_request.require_exactly_one_closing_reference &&
    closingReferences.length !== 1
  ) {
    violations.push(
      `pull-request body must contain exactly one closing reference: found ${closingReferences.length}`,
    );
  }

  const closingReference = closingReferences.length === 1 ? closingReferences[0] : null;
  if (
    closingReference &&
    contract.pull_request.require_same_repository_issue &&
    (closingReference.owner || closingReference.repo)
  ) {
    violations.push(`cross-repository closing reference is not allowed: ${closingReference.text}`);
  }
  if (
    closingReference &&
    branchMetadata.issue &&
    closingReference.issue !== branchMetadata.issue
  ) {
    violations.push(
      `closing issue ${closingReference.issue} does not match branch issue ${branchMetadata.issue}`,
    );
  }

  if (branchMetadata.issue && sections.has("Issue")) {
    const issueSection = sections.get("Issue");
    const expectedIssueLine = canonicalIssueLine(contract, branchMetadata.issue);
    const expectedWorktreeLine = canonicalWorktreeLine(
      contract,
      branchMetadata.issue,
      branchMetadata.slug,
    );
    const lines = issueSection.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    if (!lines.includes(expectedIssueLine)) {
      violations.push(`Issue section must contain exact line: ${expectedIssueLine}`);
    }
    if (!lines.includes(expectedWorktreeLine)) {
      violations.push(`Issue section must contain exact line: ${expectedWorktreeLine}`);
    }
  }

  const meaningfulRequirements = [
    ["Summary", "require_nonempty_summary"],
    ["Verification", "require_nonempty_verification"],
    ["Safety", "require_nonempty_safety"],
  ];
  for (const [section, flag] of meaningfulRequirements) {
    if (contract.pull_request[flag] && sections.has(section)) {
      if (!meaningfulSectionContent(sections.get(section))) {
        violations.push(`pull-request section must contain concrete content: ${section}`);
      }
    }
  }

  return {
    issue: branchMetadata.issue,
    slug: branchMetadata.slug,
    branch: branchMetadata,
    closingReferences,
    violations: [...new Set(violations)].sort(),
  };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function repositoryAbsolutePath(repositoryRoot, relativePath) {
  const normalized = normalizeRepositoryPath(relativePath);
  const absolutePath = path.resolve(repositoryRoot, ...normalized.split("/"));
  const relative = path.relative(repositoryRoot, absolutePath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`repository path escapes root: ${relativePath}`);
  }
  return absolutePath;
}

function validatePullRequestTemplate(contents, contract) {
  const violations = [];
  const { sections, duplicates } = extractMarkdownSections(contents);
  for (const section of contract.pull_request.required_sections) {
    if (!sections.has(section)) violations.push(`pull-request template is missing section: ${section}`);
    if (duplicates.includes(section)) violations.push(`pull-request template repeats section: ${section}`);
  }
  if (!String(contents).includes("Closes #ISSUE_NUMBER")) {
    violations.push("pull-request template must contain Closes #ISSUE_NUMBER");
  }
  if (!String(contents).includes("Worktree: `.worktrees/issue-ISSUE_NUMBER-delivery-slug`")) {
    violations.push("pull-request template must contain the canonical worktree placeholder");
  }
  return violations;
}

function validateIssueTemplate(contents) {
  const violations = [];
  for (const heading of ["Outcome", "Scope", "Acceptance", "Safety"]) {
    if (!new RegExp(`^## ${escapeRegExp(heading)}$`, "mu").test(contents)) {
      violations.push(`issue template is missing section: ${heading}`);
    }
  }
  return violations;
}

export function validateDeliveryWorkflow(contents) {
  const violations = [];
  const text = String(contents ?? "");
  if (!/^name:\s*Delivery Contract\s*$/mu.test(text)) {
    violations.push("delivery workflow must retain its canonical name");
  }
  if (!/^\s{2}pull_request:\s*$/mu.test(text)) {
    violations.push("delivery workflow must use pull_request");
  }
  for (const forbiddenTrigger of ["pull_request_target", "push", "schedule", "workflow_dispatch"] ) {
    if (new RegExp(`^\\s{2}${escapeRegExp(forbiddenTrigger)}:`, "mu").test(text)) {
      violations.push(`delivery workflow must not use trigger: ${forbiddenTrigger}`);
    }
  }
  for (const eventName of REQUIRED_WORKFLOW_EVENTS) {
    if (!new RegExp(`^\\s{6}- ${escapeRegExp(eventName)}\\s*$`, "mu").test(text)) {
      violations.push(`delivery workflow is missing pull_request event: ${eventName}`);
    }
  }
  for (const permission of ["contents", "issues", "pull-requests"]) {
    if (!new RegExp(`^\\s{2}${escapeRegExp(permission)}:\\s*read\\s*$`, "mu").test(text)) {
      violations.push(`delivery workflow permission must be read-only: ${permission}`);
    }
  }
  if (/^\s+[a-z-]+:\s*write\s*$/gmu.test(text)) {
    violations.push("delivery workflow must not request write permissions");
  }
  if (/\$\{\{\s*secrets\./u.test(text)) {
    violations.push("delivery workflow must not read repository secrets");
  }
  if (!text.includes("GH_TOKEN: ${{ github.token }}")) {
    violations.push("delivery workflow must use the read-only github.token");
  }
  if (
    !text.includes("node scripts/release/check-delivery-contract.mjs") ||
    !text.includes("--event \"$GITHUB_EVENT_PATH\"") ||
    !text.includes("--github-api")
  ) {
    violations.push("delivery workflow must invoke the event and GitHub API validator");
  }
  for (const forbiddenCommand of ["git push", "gh pr edit", "gh issue edit", "gh issue close"] ) {
    if (text.includes(forbiddenCommand)) {
      violations.push(`delivery workflow contains forbidden mutation command: ${forbiddenCommand}`);
    }
  }
  return [...new Set(violations)].sort();
}

export function validateDeliveryRepository({ repositoryRoot = repoRoot, contract }) {
  const violations = validateDeliveryContractShape(contract);
  for (const [key, relativePath] of Object.entries(contract.files ?? {})) {
    const absolutePath = repositoryAbsolutePath(repositoryRoot, relativePath);
    if (!existsSync(absolutePath)) violations.push(`missing delivery ${key}: ${relativePath}`);
  }
  if (violations.length > 0) return [...new Set(violations)].sort();

  const workflow = readFileSync(
    repositoryAbsolutePath(repositoryRoot, contract.files.workflow),
    "utf8",
  );
  violations.push(...validateDeliveryWorkflow(workflow));
  const pullRequestTemplate = readFileSync(
    repositoryAbsolutePath(repositoryRoot, contract.files.pull_request_template),
    "utf8",
  );
  violations.push(...validatePullRequestTemplate(pullRequestTemplate, contract));
  const issueTemplate = readFileSync(
    repositoryAbsolutePath(repositoryRoot, contract.files.issue_template),
    "utf8",
  );
  violations.push(...validateIssueTemplate(issueTemplate));
  return [...new Set(violations)].sort();
}

function eventPullRequestContext(event) {
  const pullRequest = event?.pull_request;
  if (!pullRequest) throw new Error("event payload does not contain pull_request");
  return {
    number: pullRequest.number ?? event.number,
    title: pullRequest.title ?? "",
    body: pullRequest.body ?? "",
    draft: pullRequest.draft === true,
    baseRef: pullRequest.base?.ref,
    headRef: pullRequest.head?.ref,
    baseRepository: pullRequest.base?.repo?.full_name ?? event.repository?.full_name,
    headRepository: pullRequest.head?.repo?.full_name,
    repository: event.repository?.full_name ?? pullRequest.base?.repo?.full_name,
  };
}

async function githubJson(url, { token, fetchImpl = fetch }) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "zhipanda-delivery-contract",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`GitHub API returned non-JSON response for ${url}: ${response.status}`);
  }
  if (!response.ok) {
    const message = payload?.message ?? response.statusText;
    throw new Error(`GitHub API request failed for ${url}: ${response.status} ${message}`);
  }
  return payload;
}

export async function validateRemoteDelivery({
  context,
  metadata,
  contract,
  token,
  fetchImpl = fetch,
}) {
  const violations = [];
  if (!token) return ["GH_TOKEN is required for remote delivery validation"];
  if (!context.repository) return ["event repository is missing"];
  if (!metadata.issue) return ["branch issue is unavailable for remote validation"];

  const repository = encodeURIComponent(context.repository).replaceAll("%2F", "/");
  try {
    const issue = await githubJson(
      `https://api.github.com/repos/${repository}/issues/${metadata.issue}`,
      { token, fetchImpl },
    );
    if (issue.pull_request) {
      violations.push(`referenced object #${metadata.issue} is a pull request, not an Issue`);
    }
    if (contract.pull_request.require_open_issue && issue.state !== "open") {
      violations.push(`referenced Issue #${metadata.issue} is not open: ${issue.state}`);
    }
  } catch (error) {
    violations.push(error instanceof Error ? error.message : String(error));
  }

  if (contract.pull_request.require_unique_open_pull_request) {
    try {
      const openPullRequests = [];
      for (let page = 1; page <= 20; page += 1) {
        const pageItems = await githubJson(
          `https://api.github.com/repos/${repository}/pulls?state=open&base=${encodeURIComponent(contract.repository.default_branch)}&per_page=100&page=${page}`,
          { token, fetchImpl },
        );
        if (!Array.isArray(pageItems)) throw new Error("GitHub pulls response must be an array");
        openPullRequests.push(...pageItems);
        if (pageItems.length < 100) break;
        if (page === 20) throw new Error("open pull-request pagination exceeded safety limit");
      }

      for (const pullRequest of openPullRequests) {
        if (pullRequest.number === context.number) continue;
        const sameHead =
          pullRequest.head?.ref === context.headRef &&
          pullRequest.head?.repo?.full_name === context.headRepository;
        if (sameHead) {
          violations.push(
            `another open pull request uses branch ${context.headRef}: #${pullRequest.number}`,
          );
        }
        const references = extractClosingReferences(pullRequest.body ?? "", contract);
        if (references.some((reference) => reference.issue === metadata.issue)) {
          violations.push(
            `another open pull request closes Issue #${metadata.issue}: #${pullRequest.number}`,
          );
        }
      }
    } catch (error) {
      violations.push(error instanceof Error ? error.message : String(error));
    }
  }

  return [...new Set(violations)].sort();
}

function parseArguments(argv) {
  const options = {
    mode: "local",
    contractPath: defaultContractPath,
    eventPath: null,
    githubApi: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--local") options.mode = "local";
    else if (argument === "--repository") options.mode = "repository";
    else if (argument === "--event") {
      options.mode = "event";
      options.eventPath = argv[index + 1];
      index += 1;
    } else if (argument === "--github-api") options.githubApi = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--contract") {
      options.contractPath = path.resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (options.mode === "event" && !options.eventPath) {
    throw new Error("--event requires a payload path");
  }
  if (options.githubApi && options.mode !== "event") {
    throw new Error("--github-api requires --event");
  }
  return options;
}

export async function checkDeliveryContract({
  mode = "local",
  repositoryRoot = repoRoot,
  contractPath = defaultContractPath,
  eventPath = null,
  githubApi = false,
  token = process.env.GH_TOKEN,
  fetchImpl = fetch,
  quiet = false,
} = {}) {
  const contract = readJson(contractPath);
  const violations = validateDeliveryRepository({ repositoryRoot, contract });
  const report = { mode, issue: null, branch: null, worktree: null, remote: false };

  if (mode === "local") {
    const context = readLocalDeliveryContext({ cwd: repositoryRoot });
    const local = validateLocalDeliveryContext(context, contract);
    violations.push(...local.violations);
    report.issue = local.branch.issue ?? null;
    report.branch = local.branch.branch ?? context.branch;
    report.worktree = local.worktree.name ?? path.basename(context.repositoryRoot);
  } else if (mode === "event") {
    const event = readJson(path.resolve(eventPath));
    const context = eventPullRequestContext(event);
    const metadata = validatePullRequestContext(context, contract);
    violations.push(...metadata.violations);
    report.issue = metadata.issue ?? null;
    report.branch = context.headRef ?? null;
    report.worktree = metadata.issue && metadata.slug
      ? `${contract.worktree.parent_directory}/issue-${metadata.issue}-${metadata.slug}`
      : null;
    if (githubApi) {
      violations.push(
        ...(await validateRemoteDelivery({
          context,
          metadata,
          contract,
          token,
          fetchImpl,
        })),
      );
      report.remote = true;
    }
  } else if (mode !== "repository") {
    violations.push(`unsupported delivery validation mode: ${mode}`);
  }

  if (violations.length > 0) throw new DeliveryContractError(violations);
  if (!quiet) {
    const details = [report.branch, report.worktree, report.issue ? `Issue #${report.issue}` : null]
      .filter(Boolean)
      .join("; ");
    console.log(`[delivery-contract] passed mode=${mode}${details ? ` (${details})` : ""}`);
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const report = await checkDeliveryContract({
      mode: options.mode,
      contractPath: options.contractPath,
      eventPath: options.eventPath,
      githubApi: options.githubApi,
      quiet: options.json,
    });
    if (options.json) console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (error instanceof DeliveryContractError) {
      console.error(error.message);
      for (const violation of error.violations) console.error(`- ${violation}`);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  }
}
