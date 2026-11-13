---
extends: opening-a-pr
when: Opening, merging, or landing a PR you opened in this conversation in SwayingWindmill/PandaAtlas. Merging anyone else's PR needs the user's explicit consent.
---

### PandaAtlas: opening and landing a PR

`main` has no required status checks, so GitHub merges a PR the moment anyone asks, before CI has run. These steps put the gate in the workflow.

- **After** "Commit bodies don't restate the subject." Write commit subjects, commit bodies, PR titles, and PR bodies in Chinese. Keep the Conventional Commits `type(scope):` prefix in English. Fill the sections of `.github/PULL_REQUEST_TEMPLATE.md`.
- **Replace** "Post the URL and keep building." Post the URL. Do not run `gh pr merge --auto` and do not turn on auto-merge in the app. Then land the PR this way:
  1. Wait for the PR's own `Development Verification` run to finish green (`gh run watch <id> --exit-status`).
  2. Get an independent PASS from a reviewer that did not write the change, for example `pstack:thermo-nuclear-review-subagent` on the PR diff. Your own review, the tests, and CI do not count.
  3. Merge with `gh pr merge <n> --squash --match-head-commit <reviewed head SHA>`.
  4. Watch the `Development Verification` run on `main` for the merge commit.
  5. Stop. A production deploy waits on the `Production` environment approval. Approve it only when the user says so in this conversation.
