# Tasks

Working list for the App v2 build-out. Spec #682 and tickets #683–#694 live in GitHub Issues; this file records progress and verification. Items needing the owner are in `USER_ACTIONS_REQUIRED.md`.

## Release pipeline

- [x] Publication release workflow: `release.build` / `release.publish` batch operations (#680).
- [x] Release builds below PostgreSQL's bind-parameter limit (#681); deployed.
- [x] `release.build` for `2026.10.26.1` ([run 40337956764](https://github.com/SwayingWindmill/PandaAtlas/actions/runs/40337956764)), release `daf46238-544c-44ff-ab25-8d936af81fec`, not public. 59 changes against `2026.10.02.1-photo-only`:
  - institution +5: 上野动物园, 中国大熊猫保护研究中心, 亚特兰大动物园, 史密森国家动物园, 成都大熊猫繁育研究基地
  - place ~8: the eight facilities above gain institution links, coordinates and visit guides
  - panda +17: a-bao, cheng-lan, da-mei-changsha, er-qiao, jing-liang, lun-hui, ni-ke, ni-na, qi-fu-changsha, qi-zhen, ya-li, ya-lun, ya-song, yang-yang, yong-ba, zhi-ma, zhi-shi; ~1: xing-er
  - lineage +6, residency +5 (Ya Lun and Yang Yang at Zoo Atlanta and Chengdu, Lun Hui at Chengdu), life_event +17 (births, Zoo Atlanta arrival 1999 and return 2024)
  - media, evidence: unchanged
- [ ] `release.publish` for `2026.10.26.1`: owner decision (`USER_ACTIONS_REQUIRED.md`).

## App v2 (apps/mobile)

Done before this list: tabs (今天, 找熊猫), Daily Panda, panda profile, family tree, institution list and pages.

The `to-tickets` step normally asks the owner to approve the breakdown; the owner asked for uninterrupted work, so the tickets were published as drafted and can be re-cut at any time.

| Ticket                           | Delivers                                                                                                                                    | Blocked by      | Status                                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in (#683)                   | Email-code sign-in with Supabase Auth, SecureStore session, account provisioning, authenticated API client, 我的 tab with name and sign-out | none            | done (#695): e2e 2/2 on local stack                                                                                                                                                                                                                            |
| Follow and 见过 (#684)           | Follow toggle and 见过 with date on profiles, followed list in 我的                                                                         | Sign-in         | done (#696): e2e follow, 见过, reload, 我的 list, unfollow                                                                                                                                                                                                     |
| 图鉴 (#685)                      | Panda book tab, signed-out explanation, Daily Panda result saved to the account                                                             | Sign-in         | done: e2e signed-out state and 见过 joining the book; unit tests for book rules. Daily result save is wired (POST /me/daily-panda-results) but not e2e: finishing a puzzle needs six local pandas                                                              |
| 猜熊猫 (#686)                    | Photo question with four names, answer feedback, results feed the 图鉴                                                                      | none            | done: the API's question now carries the photo's object key from the active release (web route drops four detail fetches); e2e signed-out round and signed-in answer joining the 图鉴. Production has no published questions yet (`USER_ACTIONS_REQUIRED.md`)  |
| Calendar (#687)                  | Birthdays and moves by month from public data                                                                                               | none            | done: 熊猫日历 from 今天, month grid with marked days, list by day opening profiles; birthdays of living pandas from `birth_date`, day-precise life events per participant; 6 unit tests, e2e walks to July 2026 and opens the fixture panda from its birthday |
| Photos and sources (#688)        | Photo viewer with credits, evidence sources of a profile                                                                                    | none            | todo                                                                                                                                                                                                                                                           |
| 纠错 (#689)                      | Report a mistake with a source (contributions)                                                                                              | Sign-in         | todo                                                                                                                                                                                                                                                           |
| Account and notifications (#690) | In-app inbox, notification preferences, data export and account deletion requests                                                           | Sign-in         | todo                                                                                                                                                                                                                                                           |
| 查关系 (#691)                    | Relationship between two pandas from lineage                                                                                                | none            | todo                                                                                                                                                                                                                                                           |
| 今天 (#692)                      | Changes to followed pandas from release updates, alongside the Daily Panda                                                                  | Follow and 见过 | todo                                                                                                                                                                                                                                                           |
| Onboarding (#693)                | Welcome and follow a few pandas on first launch                                                                                             | Follow and 见过 | todo                                                                                                                                                                                                                                                           |
| Offline and share (#694)         | Offline banner keeping loaded data, profile share card                                                                                      | none            | todo                                                                                                                                                                                                                                                           |

## Fixes along the way

- Local admin runtime and first-admin bootstrap required `API_URL` from `supabase status`, which the CLI omits since the local Data API was turned off (#671); both now fall back to the Auth gateway on port 54321.
- Session state never left "loading" when no session was stored (first-read sentinel); found by the sign-in e2e test.
- Supabase answers `otp_expired` for a wrong code as well; the app's message now covers both.
- The e2e sign-in helper accepted the code screen (which also shows the address) as signed in; it now waits for 退出登录.
- The back button on pushed screens read `canGoBack()` once at render, before an expo-router push settled on web, so screens opened from a tab showed none; `PageHeader` now subscribes to the navigation state.
- The e2e fixture recorded the birth date as `birth.date`; the public read model lists `birth_date`, so the fixture panda had no birthday until the calendar test caught it.
- e2e journeys seed their own panda through the API's domain modules and publish it with the release command (`e2e/global-setup.ts`); an older local database needs `npx supabase migration up --workdir infra --local` first.

## Verification log

Each ticket records: typecheck, lint, unit tests, Expo iOS/Android export, and the Playwright journey against the local API and local Supabase (signed-in flows use a local test account).
