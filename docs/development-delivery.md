# Governed issue-to-PR delivery

Repository implementation work follows one accountable chain:

```text
Issue -> branch -> isolated worktree -> pull request -> main
```

The machine-readable rules are in [`contracts/delivery-workflow.v1.json`](../contracts/delivery-workflow.v1.json), and the validator is available through:

```bash
npm run check:delivery-contract
```

## Start work

Create one Issue that defines one bounded outcome, acceptance checks, and explicit safety exclusions. Use its number in both the branch and worktree names:

```text
<branch-type>/issue-<number>-<slug>
.worktrees/issue-<number>-<slug>
```

Example:

```text
chore/issue-270-delivery-contract
.worktrees/issue-270-delivery-contract
```

Supported branch types are `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, and `perf`. Slugs use lowercase letters, digits, and single hyphens.

Each implementation pull request targets `main` directly. Stacked implementation pull requests are not part of the governed flow because changing their bases after predecessor merges can recreate conflicts and obscure the single accountable Issue.

## Pull-request body

The pull-request body must contain each section exactly once:

```markdown
## Issue

Closes #270

Worktree: `.worktrees/issue-270-delivery-contract`

## Summary

- Bounded implementation summary.

## Verification

- Commands and acceptance checks that passed.

## Safety

- Production, data, secret, deployment, DNS, and release actions not performed.
```

Exactly one supported closing keyword may appear in the body, and its Issue number must match the branch and worktree. Cross-repository closing references and multiple closing Issues fail closed.

## Local validation

Run the delivery check from the isolated worktree before opening the pull request:

```bash
npm run check:delivery-contract
```

The local check verifies:

- the current branch name;
- the current worktree parent and directory name;
- the Issue number and slug match between branch and worktree;
- the worktree is registered by Git;
- the current branch is not protected.

The local check cannot prove that a pull-request body or remote Issue is correct. The read-only GitHub workflow performs those remote checks after the pull request opens or changes.

## Pull-request validation

The [`Delivery Contract`](../.github/workflows/delivery-contract.yml) workflow verifies:

- base branch is `main`;
- head branch and repository satisfy the contract;
- required body sections are present and non-empty;
- one canonical `Closes #<issue>` line matches the branch;
- the declared worktree path matches the branch;
- the referenced object is an open Issue, not another pull request;
- no other open pull request closes the same Issue;
- workflow permissions remain read-only.

The workflow does not modify branches, Issues, pull requests, deployments, secrets, data, DNS, or production state.

## Exceptions

Emergency or automated work is not silently exempt. A new exception requires an explicit contract change, tests, and review in its own Issue-linked pull request.
