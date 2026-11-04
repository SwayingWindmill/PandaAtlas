# 双胞胎/相似熊猫 · skill review (2026-11-04)

Scope: `/look-alikes`, entry 找熊猫 → 探索 → 双胞胎和像的熊猫. Each row opens the existing `/compare?a=&b=`.
Pairs come only from data: twins = same sourced mother link + same exact birth date; others = pairs a published 认脸挑战 already sets side by side. No claim that any pair "looks alike" is written by the app.
Screenshots: `/workspace/feature-shots/look-alikes/{normal,dark,dt200,w320}/list.png`.

## References
- Messages / Contacts two-person avatar (overlapping round faces): https://support.apple.com/guide/iphone/send-and-reply-to-messages-iph01ad4a7ab/ios
- Apple Settings grouped list rows (leading media, one-line label, chevron): https://developer.apple.com/design/human-interface-guidelines/lists-and-tables

## impeccable
- Grouped list + round `PandaThumb`; tokens only; one-line titles. Explanation text is the slot `LOOK_ALIKE_NOTES[pairKey]`; production shows nothing until filled, `__DEV__` shows 〔待文献与写作补充〕.
## review-animations
- `PAGE_ENTER` only.
## break-ui
- Found: at large text the 70pt-wide double thumb squeezed the label into one column. Fixed: thumbs drop out when `useStacked()` (fontScale ≥ threshold or narrow). Note: the web dt200 shot zooms CSS without changing `fontScale`, so that screenshot still shows the squeezed row; native Dynamic Type takes the stacked path.
- Load failure → `LoadFailed` with retry; no pairs → `ScreenState`.
## make-interfaces-feel-better
- Row is the 44pt+ target; `accessibilityLabel` "对比A和B"; thumbs are decorative (`accessible={false}`).
