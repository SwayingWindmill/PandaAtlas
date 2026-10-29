import { describe, expect, it } from "vitest";

import { legalDocuments, signInConsent, signInConsentText } from "./legal";

describe("legal documents", () => {
  it("opens the public Chinese pages", () => {
    expect(legalDocuments.terms).toEqual({ label: "用户协议", url: "https://www.zhipanda.com/zh/terms" });
    expect(legalDocuments.privacy).toEqual({ label: "隐私政策", url: "https://www.zhipanda.com/zh/privacy" });
  });

  it("states that signing in agrees to both documents", () => {
    expect(signInConsent.terms.label).toBe("《用户协议》");
    expect(signInConsent.privacy.label).toBe("《隐私政策》");
    expect(signInConsentText()).toBe("登录即表示同意《用户协议》和《隐私政策》");
  });
});
