# 吱熊猫 ZhiPanda logo exploration

本目录按 `op7418/logo-generator-skill` 的 Phase 1–2 流程产出：先从项目现有品牌与设计合同中提取约束，再生成 6 个真正不同的 SVG 方向，并用交互展示页做尺寸、明暗与 wordmark 场景对比。

## Brand brief used

- Public brand: **吱熊猫 / ZhiPanda**。
- Audience: panda enthusiasts first。
- Product center: individual panda profiles, panda families, life journeys, places, sources, and continued exploration。
- Tone: warm, lively, curious, concise, non-childish, evidence-honest。
- Visual foundation: Living Archive — warm but not sentimental, archival but not antique, precise but not clinical。
- Palette: field-paper neutral + mineral/botanical near-black + one moss/forest-green accent family。
- Explicitly avoided: AI purple/blue glow, generic bamboo decoration, mascot narration, cute facial expressions, decorative maps, and audit-console aesthetics。

The palette in `showcase.html` uses the production tokens from `apps/web/styles/tokens.css`:

- canvas `#f7f6f1`
- ink `#172019`
- accent `#397253`
- accent strong `#24543a`
- dark canvas `#101611`
- dark accent `#78aa7e`

## Variants

| # | Direction | Primary meaning | Assessment |
|---|---|---|---|
| 01 | Echo Orbit | squeak / echo / open-ended exploration | Most restrained; weakest panda-category recognition |
| 02 | Panda Mask | panda identity through ears + negative-space eye patches | **Primary recommendation**: strongest recognition and small-size stability |
| 03 | Kinship Node | family and relationship exploration | Most faithful to the information architecture, but can read as a generic network tool |
| 04 | Journey Z | ZhiPanda initial + life journey + endpoints | **Secondary recommendation**: strongest proprietary-brand feel, especially in English contexts |
| 05 | Zhi Glyph | Chinese brand-name abstraction | Highest bilingual/cultural potential; needs another proportion-refinement pass |
| 06 | Panda Gaze | panda eye patches + dual/relational form | Fashion-forward and abstract; line weight needs careful favicon tuning |

## Files

- `01-echo-orbit.svg`
- `02-panda-mask.svg`
- `03-kinship-node.svg`
- `04-journey-z.svg`
- `05-zhi-glyph.svg`
- `06-panda-gaze.svg`
- `showcase.html` — interactive comparison at 24 / 44 / 96 px and paper / monochrome / dark themes

All marks use `viewBox="0 0 100 100"` and `currentColor`, so production code can inherit Foundation brand tokens instead of baking decorative colors into the asset.

## Approved direction

The exploration is now superseded by the approved **07 Resting Panda** direction. See `APPROVED.md` and `07-approved-resting-panda.svg`.

## Recommended next pass

The symbol direction is selected. Preserve the approved resting pose and continue with production refinement:

1. refine geometry at 16, 24, 32, 44, and 96 px;
2. export transparent PNG and favicon/app-icon sizes;
3. build horizontal Chinese and English lockups;
4. test one-color, reversed, and accessibility-safe brand-green usage;
5. replace the temporary `吱 / Z` letter tile in `GlobalNavigation` only after approval;
6. update public metadata icons and add visual regression coverage for the navigation mark.

High-end showcase mockups from the upstream skill are intentionally deferred until a direction is approved; producing them before selection would add polish without reducing the design decision.
