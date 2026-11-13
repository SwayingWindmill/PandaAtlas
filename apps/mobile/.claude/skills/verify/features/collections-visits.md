# Collections and visits

A signed-in fan puts a panda into a new collection, finds it under 我的, renames it, empties it and deletes it after a confirmation. On a zoo's 攻略 tab the fan records today's visit, which then shows under 去过的地点 and can be removed there.

## Sub-features

- `collection-create` creates a collection from a panda's profile (加入合集).
- `collection-manage` renames, removes a panda, and deletes with a confirmation.
- `visit-record` records today's visit on 攻略.
- `visit-remove` removes a visit on `/visits`.
- `visit-signed-out` shows a sign-in prompt in place of the record button.

## How to get to it (user POV)

- A panda's profile, then `加入合集`. 我的, then 我的合集, then a collection.
- A venue page, then `攻略`, then `记下今天去过<facility>`. 我的, then 去过的地点.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`. Each journey signs in its own user.

- **Collection lifecycle.** Run `npx e2e run tests/collections-visits.e2e.ts:7` from `apps/mobile`. At the end, `button "删除合集"` opens `heading "删除「常去看的」？"`. Confirming returns to `heading "我的合集"`, and `button /^常去看的，/` has count 0.
- **Record and remove a visit.** Run `npx e2e run tests/collections-visits.e2e.ts:41`. It opens the zoo, taps `radio "攻略"`, then `button "记下今天去过<facility>"`. The result is `<today>去过`, and the button `今天已记下去过<facility>` is disabled. On `/visits`, the delete button removes it, and `还没有到访记录。` shows.
- **Signed out.** Run `npx e2e run tests/collections-visits.e2e.ts:57`.

## Gotchas

- The delete confirmation moves screen-reader focus with an API that exists only on native, so it is skipped on web. Native focus behavior is not covered by a web run.
- The confirmation replaces the screen, so its `删除合集` is the only one on screen.
