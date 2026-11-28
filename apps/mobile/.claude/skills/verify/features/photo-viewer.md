# Photo viewer

A panda's photos open at `/pandas/[slug]/photos` as a stack screen (`照片`). The counter `1 / N` sits under the navigation bar (`accessibilityLiveRegion="polite"`). Each page renders `ZoomablePhoto` with pure Reanimated + `PanResponder` pinch/double-tap/pan (1x to 3x, 2.2x double-tap). Below the pager sit the gesture hint, the photo's credit, 分享 and 保存 controls, and 上一张, 放大 / 还原, 下一张 buttons.

## Sub-features

- `photo-viewer-open` opens from a profile (`查看<名字>的照片，共 N 张` or a `照片 K` peek tile) with the counter, credit and navigation controls.
- `photo-viewer-page` pages by horizontal swipe or 上一张 / 下一张. End chevrons are disabled (`aria-disabled`), and paging resets zoom to 1x.
- `photo-viewer-zoom` zooms by pinch (1x–3x), double-tap (2.2x), or tapping 放大 / 还原; paging locks while zoomed.
- `photo-viewer-actions` shares or saves the current photo through `photo-actions.ts`: on native, 分享 downloads to `Paths.cache/shared-photos` and opens the system share sheet via `expo-sharing` `shareAsync` (avoiding RN `Share.share` iOS cancel hang), and 保存 requests write-only `photo` media-library permission (`expo-media-library`) before saving via `saveToLibraryAsync` from `expo-media-library/legacy` on iOS (decoding `.webp` via `UIImage` for Photos) or `Asset.create` on Android; on web, both download through a blob URL (`downloadOnWeb`) or open the original in a new tab if CORS blocks `fetch`. Status feedback (`已保存到相册` / `已开始下载` / `已在新标签页打开原图` / permission messages) appears with `role="status"` and clears after 3 s.

## How to get to it (user POV)

- On a panda's profile (`/pandas/[slug]`), tap `查看<名字>的照片，共 N 张` or any `照片 K` preview tile.
- Deep link directly to `/pandas/<slug>/photos` or `/pandas/<slug>/photos?index=1`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`. The fixture panda is `fixture().panda` (`.name`, `.slug`).
- **Open, page, zoom, share, save.** Run `npx e2e run tests/photos-sources.e2e.ts` from `apps/mobile`:
  - Opens `/pandas/<slug>`, taps `查看<名字>的照片，共 2 张`, checks `1 / 2`, credit, and `上一张` disabled; pages to `2 / 2`, taps `返回` back to profile.
  - Opens `照片 2` tile directly to `2 / 2` and toggles `放大照片` / `还原照片大小`.
  - Checks `分享` and `保存` buttons inside `dialog "照片"`, taps `保存` and asserts a real downloaded image file plus `已开始下载` status text.

## Gotchas

- `ZoomablePhoto` intentionally avoids `react-native-gesture-handler` so it works cleanly across iOS, Android, Expo Go, and web without native gesture-handler conflicts.
- `expo-media-library` is a native module; saving to the device album on iOS/Android requires a dev client or EAS build containing it, with Android legacy read permissions kept blocked in `app.json`.
- A web media host that blocks CORS opens the photo in a new tab (`已在新标签页打开原图`) instead of triggering a blob download.
