# Sharing a panda

A fan opens a panda's share screen and posts its card. The card carries the photo, the name, the key facts and the credit. In its footer, 吱熊猫 and a line 扫码看<名字>的家谱、照片和近况 sit beside a 72 px QR code of `https://www.zhipanda.com/zh/pandas/<slug>`. A living panda with a full birth date opened from 生日周 shows a 生日卡 in three looks, 封面, 奖章 and 海报, each with the same QR code.

## Sub-features

- `share-card` is the ordinary card. With no cover photo it shows a 132 px band with the name's first character. A name over eight characters sets the title at 28/34 on at most two lines. The credit takes at most two lines.
- `share-image` is 分享图片. On web it downloads `zhipanda-<slug>.png`. On a phone it opens the share sheet.
- `share-copy-link` is 复制链接. It copies `<名字> <链接>` and shows the pill `链接已复制` (role `status`) for about two seconds.
- `share-link` is 分享链接, the system share of the same text.
- `share-birthday-card` is the 生日卡 with the 封面 / 奖章 / 海报 radio. Its action row reads 分享, 复制链接, 分享链接.

## How to get to it (user POV)

- A panda's profile, then 分享.
- 生日周, then the 生日卡 of a panda that has a birthday this week.
- The routes `/pandas/<slug>/share` and `/pandas/<slug>/share?birthday=<age>&look=cover|medal|poster`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`. The fixture panda is `fixture().panda` (`.name`, `.slug`).

- **Ordinary card, copy and image.** Run `npx e2e run tests/offline-share.e2e.ts:67` from `apps/mobile`. It opens the profile, taps `button "分享"`, sees the footer line, taps `button "复制链接"` and sees `链接已复制` under `status`, then taps `button "分享图片"` and checks the downloaded PNG.
- **Live look with real data.** Start the production preview and open `http://localhost:8796/pandas/he-hua-chengdu/share`. Open `/pandas/ueno-shinshin-cub-2012/share` for the no-cover long name. Open `/pandas/<slug>/share?birthday=<age>&look=medal` for a 生日卡 once 生日周 names a panda and its upcoming age.
- **The QR code reads back.** Capture the card as the app does, `captureRef(card, { format: "png", result: "data-uri" })` through the 分享图片 download, then decode the PNG with a QR reader (jsQR) and compare the text with `https://www.zhipanda.com/zh/pandas/<slug>`. A screenshot scanned by a phone is the fallback.

## Gotchas

- 复制链接 on web needs a secure context (`localhost` counts) and a user gesture. A copy that fails shows no pill, on purpose.
- The preview serves production slugs, so the fixture panda's `www.zhipanda.com` link does not exist there. The QR is checked by its text, not by opening it.
- A 生日卡 appears only for a living panda with a full birth date and a whole age from 1 to 99. Any other panda shows the ordinary card even with `?birthday=`.
- `expo-clipboard` is a native module. A dev client built before this feature has no `ExpoClipboard` and 复制链接 fails there until the client is rebuilt. Web is unaffected.
- Native image capture (`result: "tmpfile"`) is not exercised by a web pass.
