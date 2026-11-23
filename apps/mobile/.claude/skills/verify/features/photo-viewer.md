# Photo viewer

A panda's photos open full screen on black. The top row has 关闭 and the counter `1 / N` (read aloud as `第 1 张，共 N 张`; iOS announces it on every page change). The bottom block has the panda's name, the photo's credit, ‹ 上一张, 分享, 保存 and › 下一张. Swiping pages through the photos at 1x. Pinch and double tap zoom; a zoomed photo pans inside its edges and the pager stops paging. A single tap hides the top row and the bottom block. A downward drag at 1x closes the viewer.

## Sub-features

- `photo-viewer-open` opens from a profile with the counter, credit and chevrons.
- `photo-viewer-page` pages by swipe or by the chevrons. The chevrons are disabled at the ends.
- `photo-viewer-zoom` zooms by pinch (1x to 4x, stretching past both) or double tap (2.5x at the tap, again to 1x). Changing page resets zoom.
- `photo-viewer-immersive` hides the chrome on a single tap and shows it on the next. With a screen reader on, the chrome never hides. Focusing a hidden control by keyboard shows it.
- `photo-viewer-dismiss` closes on a downward drag past 18% of the height or a fast flick; a shorter drag springs back.
- `photo-viewer-width` keeps the current page aligned when the window changes width.
- `photo-viewer-share` shares the original photo. On iOS the panda's name and the credit go along as text; Android's share sheet carries no text with a file, so the credit is in the file name (`<name> 照片 <credit>.jpg`, at most 200 UTF-8 bytes, without `#`, `%` or control characters). On web it downloads under the same name. The shared copy stays in the cache until the next share or save, because the receiving app may still be reading it.
- `photo-viewer-save` saves it to the photo library with add-only permission (a download on web) and shows `已保存到相册` or why it could not. When the permission is blocked for good, the message reads `保存需要相册权限，请在系统设置里允许吱熊猫添加照片。`, with no button. The cached original is deleted after the save.

## How to get to it (user POV)

- A panda's profile, then the hero photo button `查看<name>的照片，共 N 张`.
- The route `/pandas/<slug>/photos`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`. The fixture panda `fixture().panda` has two photos with credits.

- **Open, page, close.** Run `npx e2e run tests/photos-sources.e2e.ts:7` from `apps/mobile`. It taps `button "查看<name>的照片，共 2 张"`, reads `dialog "照片"`, `1 / 2`, the first credit and a disabled `button "上一张"`, taps `button "下一张"` for `2 / 2`, then taps `button "关闭"` back to `heading "<name>"`.
- **Width change.** Run `npx e2e run tests/photos-sources.e2e.ts:26`. It pages to `2 / 2`, resizes to 820×1180 and back, and checks the image `<name> 第 2 张照片` starts at x 0 each time.
- **Touch paging on web.** Run `npx e2e run tests/photos-sources.e2e.ts:53`. It reads the computed `touch-action` above `<name> 第 1 张照片`: `pan-x` at 1x, `none` after a double tap, `pan-x` again after the next.
- **Touch swipe and pinch.** e2e and the browser pane send mouse input only. For real touch, use a Playwright context with `hasTouch: true, isMobile: true` and send `Input.dispatchTouchEvent` through a CDP session against the preview. A horizontal one-finger swipe at 1x must move the counter to `2 / 2`, and the same swipe while zoomed must not. For a pinch, start one finger, add the second, then move both apart. Web pinch activates only after about 1.4× of span. While the fingers are down, `translateX / scale` of the transformed view must stay constant when the fingers are centred on the viewport.
- **Live look with real data.** Start the production preview and open `http://localhost:8796/pandas/<slug>/photos` for a panda with several photos. Double-click the photo to zoom (the counter stays and the pager stops paging: `下一张` still works and resets zoom). Click once and wait 300 ms for the chrome to fade (`opacity` 0 on the top row). Drag down with the mouse past a fifth of the height to close.

## Gotchas

- A single tap waits out the double-tap window, `maxDelay` 250 ms, before the chrome toggles.
- gesture-handler 3.3's web handlers drop the detector's `touchAction` whenever a gesture's config is applied and fall back to `none`. So each gesture carries `touchAction` itself (web only).
- Gestures report focal points in the coordinates of the detector's child. That child is an untransformed `View`, and the transformed view sits inside it; without it a second pinch on a zoomed photo drifts away from the fingers.
- After a resize the old pages briefly stop filling the scroller and the browser clamps the offset to the first page. The pager ignores scroll events whose width differs from the page width.
- The pager is react-native-gesture-handler's `FlatList`. On native, each page's pinch and pan `block` the pager's scroll gesture, so the pager scrolls only after both fail. The pan's offsets are shared values that follow the scale on the UI thread: at 1x sideways travel fails it, while zoomed nothing does, so the pager is locked from the frame a zoom starts. A one-finger swipe fails the pinch once it passes 12 pt. On web there is no pager gesture; `scrollEnabled` and `touch-action` do the same job. None of the native relations has been checked on a device yet.
- Pinch needs two touch points. A desktop browser cannot produce it, so pinch is proven only on a device or simulator.
- The web pager pages by swipe on touch and by the chevrons or a horizontal wheel with a mouse; a sideways mouse drag does not page it.
- 保存 and 分享 on native need a dev client rebuilt with expo-media-library and react-native-gesture-handler. On web they download through a blob URL. A photo host that refuses CORS to the page's origin (production photos from the localhost preview) opens the original in a new tab instead; the browser pane blocks that tab for agent clicks, so the preview shows `照片没有保存下来，请稍后再试。`.
- The browser pane throttles a hidden or background tab, so springs there take seconds. Read end states, not timings.
