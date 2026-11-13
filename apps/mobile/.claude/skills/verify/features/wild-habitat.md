# Wild habitat

The map has a wild layer: the mountain ranges of the Giant Panda National Park, each sized by its wild population. Tapping a range opens a sheet with its counts and local populations. Its 栖息地页 button opens the range's own page. That page has a sketch of the populations, stat tiles, a population list with bars, nearby venues, the other ranges and the source.

## Sub-features

- `wild-layer` shows the ranges on the map. The venues layer can be turned off.
- `wild-sheet` shows a range's counts and populations.
- `wild-page` is a range's own page, reached from the sheet or by route.
- `wild-other-ranges` switches to another range from the page.

## How to get to it (user POV)

- 熊猫地图, then a range on the map (`button /^邛崃山，/`), then the sheet, then `栖息地页`.
- The route `/wild/<id>`, with `qinling`, `minshan`, `qionglai`, `daxiangling` or `xiaoxiangling`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`, or for `preview` for a read-only look. The habitat data is bundled in the app, so it needs no seed.

- **Layer and sheet.** Run `npx e2e run tests/map.e2e.ts:40` from `apps/mobile`. It checks that the venues layer switch is checked, turns it off, and checks that `button /^邛崃山，/` stays on the map.
- **Habitat page.** Run `npx e2e run tests/map.e2e.ts:60`. It opens `/wild/qionglai`. The result is that these are visible: `heading "邛崃山"`, `image "邛崃山的4个局域种群在地图上的大致位置"`, the label `野生大熊猫 519 只`, the label `/^邛崃山B，224 只/` and `link "打开数据来源"`. Tapping `button /^岷山/` then shows `heading "岷山"` and `野生大熊猫 765 只`.

## Gotchas

- The map sheet stays in the DOM under a pushed page, so a locator for the page can match the sheet too. Open `/wild/<id>` directly rather than through the sheet when asserting page content.
- Counts come from 《大熊猫国家公园总体规划（2023—2030年）》 table 1. A changed number is a data change, not a rendering bug.
