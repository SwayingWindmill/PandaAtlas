# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub issues in `SwayingWindmill/PandaAtlas`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: use `gh issue list` with suitable state and label filters
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

Run commands inside this repository so `gh` resolves the repository from the configured Git remote.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Pull requests are not included in the normal issue-triage queue. This can be changed to `yes` later if external pull requests should be treated as feature or work requests.

GitHub uses one number space for issues and pull requests. When a reference such as `#42` is ambiguous, try `gh pr view 42` and then `gh issue view 42`.

## Skill operations

When a skill says **publish to the issue tracker**, create a GitHub issue.

When a skill says **fetch the relevant ticket**, run:

```bash
gh issue view <number> --comments
```

## Wayfinding operations

The `wayfinder` skill represents a work map as one GitHub issue with child issues:

- Map issues use the `wayfinder:map` label.
- Child issues use `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Prefer GitHub sub-issues and native issue dependencies when available.
- Otherwise, record relationships using task lists, `Part of #<map>`, and `Blocked by: #<issue>` lines.
- Claim work with `gh issue edit <number> --add-assignee @me`.
- Resolve work by commenting with the result and closing the issue.
