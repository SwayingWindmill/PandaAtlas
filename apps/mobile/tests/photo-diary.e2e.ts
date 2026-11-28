import { stat } from "node:fs/promises";

import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

test("attaches local photos to check-in, exports ticket PNG collage, survives restart, and cleans up on removal", async ({ app, screen, browser }) => {
  const { panda, zoo } = fixture();
  const note = "带实拍的看猫手账";

  // Intercept Expo ImagePicker's synthetic MouseEvent("click") on <input type="file"> to supply real PNG files.
  await browser.addInitScript(() => {
    const originalDispatch = HTMLInputElement.prototype.dispatchEvent;
    HTMLInputElement.prototype.dispatchEvent = function patchedDispatch(event: Event) {
      if (this.type === "file" && event.type === "click") {
        const transfer = new DataTransfer();
        const colors = ["#2F6F35", "#0A6CDB"];
        for (let index = 0; index < colors.length; index++) {
          const canvas = document.createElement("canvas");
          canvas.width = 120;
          canvas.height = 120;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = colors[index]!;
            ctx.fillRect(0, 0, 120, 120);
          }
          const dataUrl = canvas.toDataURL("image/png");
          const base64 = dataUrl.split(",")[1] ?? "";
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          transfer.items.add(new File([bytes], `panda-shot-${index + 1}.png`, { type: "image/png" }));
        }
        Object.defineProperty(this, "files", { configurable: true, value: transfer.files });
        setTimeout(() => {
          originalDispatch.call(this, new Event("change", { bubbles: true }));
        }, 0);
        return true;
      }
      return originalDispatch.call(this, event);
    };
  });

  await signIn(app, screen, testEmail("photo-diary"));
  await app.open(`/institutions/${zoo.slug}/checkin`);
  await expect(screen.getByRole("heading", "点选见过的熊猫")).toBeVisible();

  await screen.getByRole("button", "添加实拍照片").tap();
  await expect(screen.getByText("已选 2 / 4 张　仅存本机")).toBeVisible();

  await screen.getByRole("button", "移除第 2 张实拍").tap();
  await expect(screen.getByText("已选 1 / 4 张　仅存本机")).toBeVisible();

  await screen.getByRole("button", "添加实拍照片").tap();
  await expect(screen.getByText("已选 3 / 4 张　仅存本机")).toBeVisible();

  await screen.getByLabel("看猫小记").fill(note);
  await screen.getByRole("checkbox", new RegExp(`^${panda.name}`)).tap();
  await screen.getByRole("button", /^保存本次打卡/).tap();

  await expect(screen.getByText("当日实拍")).toBeVisible();
  await expect(screen.getByText("3 张")).toBeVisible();

  const file = await browser.waitForDownload(() => screen.getByRole("button", "生成分享纪念长图").tap());
  expect(file.suggestedFilename).toMatch(/^zhipanda-ticket-.*\.png$/);
  expect((await stat(file.absolutePath)).size).toBeGreaterThan(10_000);

  await screen.getByRole("button", "查看看猫日记").tap();
  await expect(screen.getByRole("heading", "去过的地点")).toBeVisible();
  await expect(screen.getByText("手账实拍仅存本机应用隐私目录　卸载前可通过票根长图保存")).toBeVisible();
  await expect(screen.getByLabel("第 3 张现场实拍")).toBeVisible();

  // Restart app on the same device: local photo URIs and timeline collage persist without re-picking.
  await app.restart();
  await app.open("/visits");
  await expect(screen.getByText(`“${note}”`, { visible: true })).toBeVisible();
  await expect(screen.getByLabel("第 3 张现场实拍")).toBeVisible();

  // Deleting the visit cleans up its stored local photos too.
  await screen.getByRole("button", new RegExp(`^删除.*去${zoo.facility}的记录$`)).tap();
  await expect(screen.getByText("还没有到访记录。", { exact: false })).toBeVisible();
  const remainingCount = await browser.evaluate(() => {
    const raw = localStorage.getItem("visit-photos:v1");
    if (!raw) return 0;
    return Object.keys(JSON.parse(raw) as Record<string, unknown>).length;
  });
  expect(remainingCount).toBe(0);
});
