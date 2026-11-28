import { describe, expect, it } from "vitest";

import { fileName, shareText } from "./photo-viewer";

describe("shared photo", () => {
  const photo = { id: "a1", url: "https://media.example/p/a1.JPG?w=2", credit: "照片 王小明 / CC BY 4.0，CC-BY-4.0", creator: null, source: null };

  it("sends the panda's name and the credit as text", () => {
    expect(shareText(photo, "萌兰")).toBe("萌兰\n照片 王小明 / CC BY 4.0，CC-BY-4.0");
    expect(shareText({ ...photo, credit: null }, "萌兰")).toBe("萌兰");
  });

  it("carries the credit in a file name every file system accepts", () => {
    expect(fileName(photo, "萌兰")).toBe("萌兰 照片 王小明 CC BY 4.0，CC-BY-4.0.jpg");
    expect(fileName({ ...photo, credit: null, url: "https://media.example/p/a1" }, "")).toBe("a1.jpg");
  });

  const bytes = (text: string) => new TextEncoder().encode(text).length;

  it("caps a long CJK credit at 200 bytes, not 200 characters", () => {
    const name = fileName({ ...photo, credit: "熊".repeat(150) }, "萌兰");
    expect(name.endsWith(".jpg")).toBe(true);
    const stem = name.slice(0, -".jpg".length);
    expect(bytes(stem)).toBeLessThanOrEqual(200);
    expect(stem).toBe(`萌兰 ${"熊".repeat(64)}`);
  });

  it("never cuts an emoji in half at the cap", () => {
    const stem = fileName({ ...photo, credit: `${"a".repeat(190)}🐼🐼` }, "萌兰").slice(0, -".jpg".length);
    expect(stem).toBe(`萌兰 ${"a".repeat(190)}`);
    expect(bytes(`萌兰 ${"a".repeat(190)}🐼`)).toBeGreaterThan(200);
    expect(stem).not.toMatch(/[\uD800-\uDFFF]/);
  });

  it("drops characters that would break the file URI or the file system", () => {
    expect(fileName({ ...photo, credit: "#1 100% 熊猫\u0007\u001f图" }, "萌兰")).toBe("萌兰 1 100 熊猫 图.jpg");
  });

  it("keeps file URIs safe for Android MimeTypeMap across realistic credits", () => {
    for (const credit of ["Smithsonian's National Zoo", "X @NationalZoo, a+b&c=d;e!f$g~h"]) {
      const name = fileName({ ...photo, credit }, "贝贝");
      const encoded = new URL(name, "file:///cache/").pathname.slice("/cache/".length);
      expect(encoded).toMatch(/^[a-zA-Z_0-9.\-()%]+$/);
    }
    expect(fileName({ ...photo, credit: "Smithsonian's National Zoo" }, "贝贝")).toBe("贝贝 Smithsonian s National Zoo.jpg");
  });
});
