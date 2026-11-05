# 观猫时机与拍照点 skill review (2026-11-04)

A pre-merge review of the viewing-timing slots in the visit guide, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `main` (`46189c49`).

**Surfaces:** `/institutions/[slug]` 参观攻略: new 观猫时机 and 拍照点 sections per facility. Code: `features/viewing/` (day strip, slots), `features/institutions/institutions.ts` (mapping), `visitor-content.ts` + DTO + curation validator (schema).

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, profiles `normal`, `dark`, `dt200`, `w320`, with an uncommitted fixture (09:00–11:00, 14:30–16:30 active, 12:00–14:30 nap, two 【版式样例】 spots) and without it. Mobile `lint`, `typecheck`, `test` (201), `design:tokens:check`; API tsc, eslint, vitest; curation unittest (16) pass. Not seen on an iOS device.

Screenshots: `/workspace/feature-shots/viewing-timing/{normal,dark,dt200,w320}/` (`timing`, `guide`, `guide-empty`; local, not committed).

## impeccable

- Times only: 上午活跃 / 午睡 / 下午活跃 rows in day order, each with its span. No advice text; the midday plan is the nap slot itself, shown in sequence with the active windows.
- One 笋金 mark per section: the active segments of the strip. The nap is a quiet fill.

## review-animations

- No animation added.

## break-ui

- **No data:** sections are absent; the page is unchanged (`guide-empty`).
- **dt200:** rows stack span under label; strip ticks stay legible (fixed: last tick overlapped "16" before ticks were centred on their hour).
- **w320:** long spot names wrap to two lines instead of truncating.
- **Validation:** HH:MM, start before end, no overlapping active windows, ≤6 windows, ≤12 spots, in both API and curation script.

## make-interfaces-feel-better

- **Fixed:** "09:00–11:00 · 14:30–16:30" wrapped mid-span in one cell; split into one row per window.
- Tabular figures on ticks; strip range snaps to even hours so ticks are evenly spaced.

## apple-design

- References: Health's Sleep schedule bar and Weather's hourly strip (a single track, coloured spans, hour ticks below); Settings-style grouped rows for the exact values.
- The strip is hidden from VoiceOver; the rows carry the same information. Lucide `Sun` / `Moon` on category rows only; spot rows are data and have no icon. Typography via `Text` variants only.
