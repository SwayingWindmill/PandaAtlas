---
extends: opening-a-pr
when: Opening, merging, or landing a PR you opened in this conversation in SwayingWindmill/PandaAtlas. Merging any other PR, including one opened in an earlier conversation, needs the user's explicit consent.
---

### PandaAtlas: opening and landing a PR

`main` has the ruleset "main: CI must pass": the three Development Verification checks are required and nobody can bypass them. GitHub enforces CI. These steps add the half GitHub cannot enforce, an independent review of the exact head that lands.

- **After** "Commit bodies don't restate the subject." Write commit subjects, commit bodies, PR titles, and PR bodies in Chinese. Keep the Conventional Commits `type(scope):` prefix in English. Fill the sections of `.github/PULL_REQUEST_TEMPLATE.md`.
- **Replace** "Post the URL and keep building." Post the URL. Do not turn on auto-merge before the review below passes. Then land the PR this way:
  1. Get an independent PASS from a reviewer that did not write the change, for example `pstack:thermo-nuclear-review-subagent` on the PR diff. Your own review, the tests, and CI do not count.
  2. Confirm the PR's base is `main` (`gh pr view <n> --json baseRefName`). A stacked PR whose base is another branch merges into that branch, so if the base is not `main`, stop and ask the user. Then run `gh pr merge <n> --squash --auto --match-head-commit <reviewed head SHA>`. GitHub merges once the required checks pass. If you push again, the head changes and step 1 starts over.
  3. Watch the `Development Verification` run on `main` for the merge commit.
  4. Stop. A production deploy waits on the `Production` environment approval. Approve it only when the user says so in this conversation.
