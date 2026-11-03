# 问问熊猫 skill review (2026-11-01)

A pre-merge review of the 问问熊猫 screen, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `ada41c76` (main, after #766). Fixes land in the same branch.

**Surfaces:** 认识大熊猫 `/learn` (new entry row under the masthead) and 问问熊猫 `/learn/ask`. Code changed in:
- `apps/mobile/src/features/ask/ask.ts` (new): status and ask calls, the failure codes the API returns, the question cleaning the API uses (NFKC, invisible characters, spaces) so the counter matches what the server counts, and an allow-list of in-app paths a source may open.
- `apps/mobile/src/app/learn/ask.tsx` (new): the question field, starters, exchanges (question bubble, answer card, 出处 list), and the signed-out, unavailable, disabled, quota, daily-cap, rate-limited and failed states.
- `apps/mobile/src/app/learn/index.tsx`: the entry row, shown only to a signed-in fan while the API reports `enabled`.
- `apps/mobile/src/components/icons.ts`: `MessageCircleQuestion` (lucide `message-circle-question-mark`) and `BookOpen`.

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome. `/api/v2/ask*` is not in production (and `ASK_ENABLED` stays off), so the proxy answers it from a fixture: the answer texts are real model outputs from `services/api/test/ask-eval`, and the sources are the real references of the pages they cite. Profiles: `base` 390×844 light and dark, `dt200` (200% text), `w320`. Scenarios: entry signed in and signed out, empty, one answer, answer + refusal, thinking, refusal, identification, near and over the 500-character limit, rate-limited, daily cap, quota used up, disabled, signed out.

Screenshots: `/workspace/ask-shots/` (local to the review box, not committed), named `<scenario>-<profile>-<scheme>.png`, with an ARIA snapshot beside each.

## impeccable

- **Fixed:** the API's prompt and refusal copy said 「知熊猫」; the app is 吱熊猫. Both now say 吱熊猫.
- **Fixed:** the first starter questions were paraphrases. They are now the exact eval questions the model answered with valid citations (in-zh-06, in-zh-01, in-zh-22), so a tap never lands on a refusal.
- **Fixed:** the footer repeated the identification rule on every visit. It now says only what a fan needs: answers are AI summaries of the sources, check the source, nothing is saved.
- A refusal is shown as muted text with “可以看看” links, never as an error. An identification question gets the face guides instead of a name.

## review-animations

- One motion: a new exchange enters with the shared `CONTENT_ENTER` (fade and 8pt rise), which Reanimated skips under Reduce Motion. Nothing animates on page load (the list is empty then).
- The thinking state is a static skeleton with “正在查资料…”, no spinner loop.

## break-ui

- **Limits come from the API contract:** 500 characters (counted after NFKC and whitespace folding), 20 a day, 5 a minute, a site-wide daily cap. The counter appears only within 100 characters of the limit and turns red past it; the send button is disabled past it, so the 400 `ask.questionTooLong` should not be reachable.
- **w320 / dt200:** “今天还能问 N 次” wraps beside the 44pt button; long article titles wrap to two lines in the 出处 rows; publisher lists end-truncate (the article page lists them in full). **Fixed:** starter questions truncated at w320; they now wrap to two lines.
- **Failures:** rate-limited and failed keep the question in the field and say why under it; quota used up and daily cap replace the field with a short card; disabled shows one sentence. A failed send removes the pending bubble rather than leaving a question without an answer.
- **Horizontal scroll:** the only x-scrollers on `/learn` are the existing face-guide carousel (same count signed in and out); `/learn/ask` has none.
- The over-limit fixture is a repeated word, not a real question; it shows the limit, not realistic text.

## make-interfaces-feel-better

- Tabular numbers on the remaining count and the counter.
- Radii: the answer card uses the grouped-list radius so it lines up with the 出处 list under it; the question bubble uses the tile radius.
- Lucide icons with meaning: `MessageCircleQuestion` for the entry and the signed-out state, `BookOpen` for every source row. A face guide or 认识大熊猫 link without publishers says what kind of page it is (认脸指南, 认识大熊猫).
- Haptics: a tap when sending, success only for an answer; nothing for a refusal.

## apple-design

- One large title, grouped inset lists, v2 tokens only (`design:tokens:check` passes), section headers as footnote headings (出处, 可以看看, 可以这样问).
- The field sits at the top, under the title, like Search: the keyboard never covers it and the newest exchange is right below it.
- VoiceOver: the field is “你的问题”, the button “提问”, each source row has a hint (打开这一页 / 在浏览器中打开原始资料), and the answer area is a polite live region so the answer is read when it arrives.
- Sources open in the app when the path is one the app has (an allow-list), otherwise in the in-app browser over https only.

## Open

- The production AI Search index is empty until a deploy runs the sync, so live retrieval in the app has not been seen end to end; the screenshots use the fixture.
- The entry is hidden while signed out, because the app cannot know whether the feature is on without a session. Once `ASK_ENABLED` is on, consider a public status flag so signed-out fans can discover it.
