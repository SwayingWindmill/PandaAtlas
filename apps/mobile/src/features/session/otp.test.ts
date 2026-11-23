import { describe, expect, it } from "vitest";

import { CODE_LIFETIME_MS, rejectedCodeMessage, secondsUntilResend } from "./otp";

describe("secondsUntilResend", () => {
  const sentAt = 1_000_000;

  it("counts down the minute after a code is sent", () => {
    expect(secondsUntilResend(sentAt, sentAt)).toBe(60);
    expect(secondsUntilResend(sentAt, sentAt + 59_001)).toBe(1);
  });

  it("is zero once the minute has passed", () => {
    expect(secondsUntilResend(sentAt, sentAt + 60_000)).toBe(0);
    expect(secondsUntilResend(sentAt, sentAt + 600_000)).toBe(0);
  });
});

describe("rejectedCodeMessage", () => {
  it("calls a refused code wrong while it is still within its lifetime", () => {
    expect(rejectedCodeMessage(0, 30_000)).toBe("验证码不对，请检查后再输入。");
  });

  it("calls it expired once its lifetime has passed", () => {
    expect(rejectedCodeMessage(0, CODE_LIFETIME_MS)).toBe("验证码已过期，请重新获取。");
  });
});
