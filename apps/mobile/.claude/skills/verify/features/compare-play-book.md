# Compare, Play, Book & Editorial (v4.5)

Batch 3 upgrades `/compare` (`比一比`), `/play` (`趣味挑战`), `/book` (`我的图鉴`), `/learn` (`认识大熊猫`), `/returning` (`归国与旅居`), and `/pandas/[slug]/family` (`家族树`), wires `/relationship?a=...&b=...` pre-fill, and redirects legacy `/comparisons` and `/week` routes to `/compare` and `/on-this-day`.

## Sub-features

- `compare-v45` (`/compare`) pairs a Split `VS` Stage picker + `精选对照` diptych cards (`link "全部双胞胎"` → `/look-alikes`) with a result view featuring `button "换选"`, swappable `VS` diptych hero, `KinshipCallout` (`link` → `/relationship?a=...&b=...`), centered-axis `核心档案对照`, and calm `外貌辨识` observation fallback (zero missing-field editorial prompts).
- `relationship-prefill` (`/relationship?a=...&b=...`) pre-fills both slots when valid and distinct, immediately showing the kinship heading and chain while preserving `from`-only callers.
- `play-v45` (`/play`) shows `heading "趣味挑战"`, a 16:10 `每日一猫` spotlight hero (`button /^每日一猫/`, conditional `连猜 N 天` streak pill), 2-col `button /^猜熊猫/` and `button /^认脸挑战/` cards, `月度挑战` `ProgressRing` banner, and `link /^双胞胎与撞脸对照/`.
- `book-v45` (`/book`) displays the Obsidian Passport `LitCard` (`点亮 N 只，共收录 ...` + `progressbar /^点亮 \d+%$/` + 3-col counters), header `button "分享我的图鉴"`, `Segmented` radios (`全部`, `见过`, `认出`), 3-col square photo tiles (`role="link"`, `No.<N>，<name>，<detail>`), `DiscoveryRow` (`去找熊猫`), and borderless `基地集邮进度` rows.
- `editorial-v45` promotes `认脸指南` directly under `FeaturedArticle` with borderless `FeedArticle` rows on `/learn` (removing `资料版本`), turns `/returning` into Flighty-style `ReturnRouteCard`s with per-panda `link "查看<name>的档案"`, and updates `/pandas/[slug]/family` to borderless `SummaryStrip` (`button "查关系"`) + hairline `GenerationSection` rows (`button "<name>"`).
- `orphan-redirects`: `/comparisons` redirects to `/compare`; `/week` redirects to `/on-this-day`.

## How to get to it (user POV)

- Open `/compare` (or from a panda profile's `比一比` quick button `/compare?a=<slug>`), `/play` (from Explore `每日一玩` header), `/book` (from 我的 `熊猫护照` or tab), `/learn`, `/returning`, and `/pandas/<slug>/family`.
- Legacy deep links `/comparisons` and `/week` open `/compare` and `/on-this-day`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`.

- **Compare, kinship link & redirects.** Run `npx e2e run tests/compare.e2e.ts` from `apps/mobile`. Verifies `/compare?a=<panda>&b=<notice>` (`heading "核心档案对照"`, `外貌辨识` fallback without `"还缺这些"`), tapping `KinshipCallout` into pre-filled `/relationship?a=...&b=...` (`heading "<notice>是<panda>的同母异父的兄弟姐妹"`), `/comparisons` → `/compare` (`heading "并排比一比"`), and `/week` → `/on-this-day` (`heading "那年今天"`).
- **Play & Book.** Run `npx e2e run tests/guess.e2e.ts`, `npx e2e run tests/daily.e2e.ts`, and `npx e2e run tests/book.e2e.ts` from `apps/mobile`.
- **Learn, Returning & Family.** Run `npx e2e run tests/learning.e2e.ts`, `npx e2e run tests/dead-ends.e2e.ts`, `npx e2e run tests/family.e2e.ts`, `npx e2e run tests/relationship.e2e.ts`, and `npx e2e run tests/worst-case.e2e.ts` from `apps/mobile`.

## Gotchas

- `LitCard` uses `variant="figure"` and `variant="stat"` inside `bg-button` (`#0A0A0A` light / `bg-card` dark) with `text-on-media`, while preserving root `accessibilityLabel` and child `ProgressRing` `progressbar` role for E2E.
- `returning.tsx` sets `aria-level="2"` on `归国与旅居` so `Stack.Screen` `"归国熊猫"` stays the level-1 heading matched by `tests/dead-ends.e2e.ts`.
