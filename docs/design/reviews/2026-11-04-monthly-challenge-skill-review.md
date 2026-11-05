# 月度主题挑战 · skill review (2026-11-04)

Scope: `/challenge`, entry 我的 → 本月挑战. Local-only (AsyncStorage key `monthly-challenge`), opt-in per month.
Screenshots: `/workspace/feature-shots/challenge/{normal,dark,dt200,w320}/{off,joined}.png`.

## References
- Apple Fitness monthly challenge / awards (progress number first, one tile): https://support.apple.com/guide/fitness-plus/see-personalized-recommendations-dev4b830ebf6/ios
- Apple Reminders checklist (circle checkbox at the leading edge): https://support.apple.com/guide/iphone/make-a-list-iph82bf06c56/ios

## impeccable
- Progress tile uses `bg-primary`/`text-primary-foreground`; checkbox ink read from `--color-primary-foreground` so it holds in dark mode. Copy is one-line labels only.
- Theme title/intro are editorial slots; in production empty slots render nothing, `__DEV__` shows 〔待编辑〕 markers.
## review-animations
- `PAGE_ENTER` only; switch uses the shared SwitchTrack timing; no new motion.
## break-ui
- Not joined → only the switch. Corrupt storage → parsed to empty state (tested). Month with no theme entry → default 4 tasks + "N月挑战". DT 200% and w320 wrap without clipping.
## make-interfaces-feel-better
- Checkbox is a 44pt target with `accessibilityRole="checkbox"` + checked state; row itself opens the task page (link). Done state is shape (filled + check), not colour alone. Haptic on toggle.
