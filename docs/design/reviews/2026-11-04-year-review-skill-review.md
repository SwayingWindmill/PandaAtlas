# 年度回顾 · skill review (2026-11-04)

Scope: `/year-review` (app-wide + `?panda=`), entries in 我的 and panda timeline.
Screenshots: `/workspace/feature-shots/year-review/{normal,dark,dt200,w320}/`.

## References
- Spotify Wrapped summary card (one bold colour field, hero number, short labels): https://newsroom.spotify.com/2025-12-03/2025-wrapped-user-experience/
- Apple Fitness awards tiles (grid of equal tiles, number first): https://support.apple.com/guide/fitness-plus/see-personalized-recommendations-dev4b830ebf6/ios
- Duolingo Year in Review (single headline stat, share-first): https://ny1.com/nyc/all-boroughs/ap-top-news/2025/12/03/how-to-find-spotify-wrapped-youtube-recap-and-more-as-2025-comes-to-a-close

## impeccable
- Card uses `bg-primary` / `text-primary-foreground` tokens; tiles use `primary-foreground/15`. No raw colours or font sizes. Fixed: removed explanatory footer, empty state shortened to one line.
- Fixed: tile icons used the `onMedia` tone (white) and vanished on the light dark-mode primary; icons removed, labels only.
## review-animations
- Only `PAGE_ENTER`; respects reduced motion. Year switch is instant (no layout animation on the card being captured). OK.
## break-ui
- DT 200%: header date wraps to two lines, tiles stack; no clipping. w320: tiles become single column via `useSingleColumn`. Empty year → `ScreenState` one line. Unknown `?panda=` → falls back to app-wide. OK.
## make-interfaces-feel-better
- Hero number uses `display` with tabular nums; continuous corner curve; 44pt buttons. Card has one combined accessibilityLabel so VoiceOver reads it once.
- Fixed: hero total no longer includes birthdays (416 dominated the number).

## Update — approved style A 回忆封面 (birthday card)
- Card is now a 4:5 full-bleed photo (the panda's first profile photo; app-wide uses the year's first birth), a bottom scrim, one big number in 笋金 (`text-warm`), one line of counts, and the photo credit.
- Known gap, waiting on the typography-① token PR: the big number uses `display` (no ui-rounded numeral / larger size token exists yet; numeric fontSize is lint-blocked). Light-mode `warm` (#846018) on the scrim is low contrast; needs an on-media gold token. Will rebase and switch to the new tokens once that PR lands.
