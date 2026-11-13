---
extends: opening-a-pr
when: Opening, merging, or landing a PR you opened in this conversation in SwayingWindmill/PandaAtlas. Merging any other PR, including one opened in an earlier conversation, needs the user's explicit consent.
---

### PandaAtlas: opening and landing a PR

`main` has the ruleset "main: CI must pass": the three Development Verification checks are required and nobody can bypass them. GitHub enforces CI as a backstop. It does not enforce review, and a push by someone with write access does not cancel auto-merge, so an armed auto-merge could land an unreviewed head. These steps keep the review on the exact head that lands.

- **After** "Commit bodies don't restate the subject." Write commit subjects, commit bodies, PR titles, and PR bodies in Chinese. Keep the Conventional Commits `type(scope):` prefix in English. Fill the sections of `.github/PULL_REQUEST_TEMPLATE.md`.
- **Replace** "Post the URL and keep building." Post the URL. Do not run `gh pr merge --auto` and do not turn on auto-merge in the app. Then land the PR this way:
  1. Wait for the PR's own `Development Verification` run to finish green (`gh run watch <id> --exit-status`).
  2. Get an independent PASS from a reviewer that did not write the change, for example `pstack:thermo-nuclear-review-subagent` on the PR diff. Your own review, the tests, and CI do not count. Wait for every reviewer you started on this PR, including ones briefed on an older head, before you merge: any FAIL on the head you will merge blocks it, and a reviewer can report again after its first result.
  3. Confirm the PR's base is `main` (`gh pr view <n> --json baseRefName`). A stacked PR whose base is another branch merges into that branch, so if the base is not `main`, stop and ask the user. Then merge now with `gh pr merge <n> --squash --match-head-commit <reviewed head SHA>`. If you pushed after the review, steps 1 and 2 start over.
  4. Watch the `Development Verification` run on `main` for the merge commit.
  5. Stop. A production deploy waits on the `Production` environment approval. Approve it only when the user says so in this conversation.
