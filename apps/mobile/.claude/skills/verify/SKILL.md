---
name: verify
description: Launch and drive the 吱熊猫 mobile app (apps/mobile, Expo) through its web build to prove a change works on the real app. Use after changing anything a user can see or do in apps/mobile, to reproduce a bug there before fixing it, or when a playbook asks for the driver skill. Two launches, the local stack with seeded data and sign-in (e2e journeys), or a read-only preview against production data.
---

# Verify the 吱熊猫 mobile app

The surface is the Expo app in `apps/mobile`, driven through its web build in a 390×844 browser. Native iOS and Android builds are not covered here. A web pass does not prove native-only code (haptics, SecureStore, `AccessibilityInfo.sendAccessibilityEvent`, maps intents), so name what it leaves unproven.

There are two launches. Pick by what the change needs.

| Launch | Data | Sign-in | Use it for |
|---|---|---|---|
| Local stack (`e2e`) | A fresh fixture per run on local Supabase | Yes, codes come from Mailpit | Anything that writes, anything signed in, and every proof that ends in a test |
| Production preview | Production's public API and photos, read only | No | How a screen looks with real content |

All commands below run from the repo root unless they say `apps/mobile`. Paths in `features/` are app routes.

## Doctor

Run this first, and again whenever a launch or a drive looks wrong:

```bash
node apps/mobile/scripts/verify-doctor.mjs --mode e2e
node apps/mobile/scripts/verify-doctor.mjs --mode preview
```

Every line must read `ok`. It checks these things, read-only:

- `node_modules` is this checkout's own. A worktree whose `node_modules` is a junction into another checkout opens on "Welcome to Expo". Fix it with `npm ci`.
- The ports are free: 3101 (API) and 8792 (app) for `e2e`, 8796 (app) and 8797 (proxy) for `preview`.
- For `e2e` only: Docker is running, local Supabase is up, and on Windows its ports are not reserved by Hyper-V.

A busy port line shows the pid and command line of the process holding it. Read it before acting:

- **A leftover from an earlier verification run in this checkout.** Its command line is this checkout's `services/api` `dist/cli.js`, its `expo ... start --web --port 8792`, or `node tests/support/stack.ts`, or `apps/mobile/scripts/preview-production.mjs`. On Windows the `stack.ts` watchdog does not always fire, so these do get left behind. End it with `taskkill /pid <pid> /T /F` (or `kill <pid>`) and rerun the doctor.
- **Anything else.** That includes another checkout's path or a process you cannot place. It belongs to someone else. Do not kill it. Report it and ask the user.

## Launch

### Local stack

1. `npm run infra:start` once. It checks the Windows port reservations first. If it stops with a `netsh` command, give that command to the user to run. It is a system setting, so never change it yourself.
2. From `apps/mobile`, run one journey: `npx e2e run tests/<file>.e2e.ts:<line>`, where `<line>` is the line its `test(` opens on. e2e starts `tests/support/stack.ts` itself. That builds the API, seeds this run's fixture through the API's own modules, then serves the API on 3101 and the app on 8792.
3. It is ready when the run prints `✓ target "mobile-web" command ready`. The first start takes about two minutes, because it builds the API and bundles the app.

Only one local stack can run per machine. The ports are fixed and every run shares the one local database. If the doctor reports 3101 or 8792 busy, wait for the other run, do not start a second.

To look at a screen live rather than through a journey, start the same stack by hand: `node tests/support/stack.ts 8792` from `apps/mobile`. Open `http://localhost:8792/<route>` in the browser pane. It is ready when `http://127.0.0.1:3101/health` answers 200 and the page renders.

### Production preview

`node apps/mobile/scripts/preview-production.mjs`, run in the background. It is ready when `http://localhost:8796` answers 200, and the first route then takes about 20 s to bundle. Open routes in the browser pane at a 390-wide viewport. It is read-only: the proxy refuses anything but GET and HEAD, so sign-in and every write fail by design.

## Drive

**Journeys.** The journeys in `apps/mobile/tests/*.e2e.ts` are the drivers. They use roles and accessible names from the app, never coordinates. Write or extend a journey for the behavior you changed, following the e2e skill at `node_modules/e2e/skills/e2e/SKILL.md`. Then run it by `file:line`.

**Live looks.** For a live look in the browser pane, find elements with `find` or `read_page` by the same accessible names the journeys use, for example `radio "攻略"`, `button "打开<场馆>的页面"`, or `image "大熊猫所在地地图"`.

**Feature recipes.** `features/README.md` indexes the recipes, one file per feature.

## Evidence

**Journey proof.** A journey proves its feature when it passes. The run's record survives in `apps/mobile/.e2e/`, which is git-ignored:

- `report.json` holds every result.
- `results/<test>/trace.md` holds every step, what the app logged, and on a failure the screen at that moment.

Quote the pass line and the trace path in the PR's Verification section.

**Live proof.** For a live look, write the route, the action, and the state after it to `apps/mobile/.e2e/verify/<feature>-<what>.txt`. The state is the `get_page_text` or `read_page` output plus any `aria-checked` or label values. Take a screenshot in the browser pane too when it draws. If the pane is hidden and clicks fail with "not on screen", ask the user to bring it forward. Until then, `find` and `get_page_text` still read the page.

**Standards.**
- Drive the path a user takes: `app.open` on a route, then taps. Never call internal setters or test-only endpoints.
- Check side effects too. After a write, reopen the screen or another view that reads it back. For example, a recorded visit must show on `/visits`.
- A preview proof covers only signed-out, read-only behavior.

## Cleanup

- **e2e.** e2e stops the stack when the run ends. On Windows a watchdog in `stack.ts` should take the API and Expo down with it, but it does not always fire. Run `node apps/mobile/scripts/verify-doctor.mjs --mode e2e` afterwards. If 3101 or 8792 is still busy, the doctor names the process. If it is this run's API or Expo, end it by its pid (`taskkill /pid <pid> /T /F` on Windows).
- **Supabase and Docker.** Stop them with `npm run infra:stop` only if you started them this session. Other sessions may be using them. On a machine short of memory, Docker and Expo together can make `npm ci` or Metro fail with an out-of-memory error, so stop what you no longer need.
- **Production preview.** Stop it by ending the process you started.
- **What stays.** `apps/mobile/.e2e/` keeps the evidence. Never delete it as part of cleanup.
