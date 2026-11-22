import type { IncomingMessage as HttpRequest } from "node:http";
import { describe, expect, it } from "vitest";
import { ContributionController } from "../src/modules/contribution/http/contribution.controller.js";
import type { ContributionPort, ContributionRecord } from "../src/modules/contribution/application/contribution.application.js";
import type { ActorContext } from "../src/modules/identity/application/identity-access.types.js";
import { setActorContext } from "../src/modules/identity/http/request-actor.js";
import type { PrivacyPort, PrivacyRequestRecord } from "../src/modules/privacy/application/privacy.application.js";
import { PrivacyController } from "../src/modules/privacy/http/privacy.controller.js";
import type { AppConfig, OpsAlertWebhookFormat } from "../src/platform/config/app-config.js";
import { OpsAlertRuntimeService } from "../src/platform/observability/ops-alert-runtime.service.js";
import { buildOpsAlertPayload, OpsAlertService } from "../src/platform/observability/ops-alert.service.js";

function configStub(options: {
  environment?: "development" | "test" | "staging" | "production";
  opsAlertWebhookUrl?: string;
  opsAlertWebhookFormat?: OpsAlertWebhookFormat;
} = {}): AppConfig {
  return {
    environment: options.environment ?? "test",
    opsAlertWebhookUrl: options.opsAlertWebhookUrl,
    opsAlertWebhookFormat: options.opsAlertWebhookFormat ?? "feishu",
  } as AppConfig;
}

function recordingLogger() {
  const entries: Array<{ level: string; message: string; fields: Record<string, unknown> }> = [];
  return {
    entries,
    logger: {
      write: (level: string, message: string, fields: Record<string, unknown> = {}) => {
        entries.push({ level, message, fields });
      },
    },
  };
}

function parseJsonBody(body: RequestInit["body"]): Record<string, unknown> {
  if (typeof body !== "string") throw new Error("Expected a JSON string body");
  return JSON.parse(body) as Record<string, unknown>;
}

function fakeActor(accountId: string): ActorContext {
  return {
    accountId,
    sessionId: "sess-1",
    aal: "aal1",
    authenticatedAt: new Date(),
    authenticationMethod: "otp",
    capabilities: new Set(["contribution.manage", "privacy.request.manage"]),
  };
}

describe("buildOpsAlertPayload", () => {
  it("formats feishu, wecom, and generic payloads and strips disallowed PII metadata keys", () => {
    const event = {
      severity: "warning" as const,
      category: "account_deletion_requested" as const,
      title: "收到账号注销申请",
      summary: "Account deletion request (priv-1)",
      metadata: {
        privacyRequestId: "priv-1",
        kind: "account_deletion",
        requestId: "req-1",
        accountId: "secret-acc-123",
        email: "fan@example.com",
        reason: "free-text personal reason",
        ip: "198.51.100.1",
      },
    };

    const feishu = buildOpsAlertPayload("feishu", event) as { msg_type: string; content: { text: string } };
    expect(feishu.msg_type).toBe("text");
    expect(feishu.content.text).toContain("[Zhipanda WARNING] 收到账号注销申请");
    expect(feishu.content.text).toContain("privacyRequestId=priv-1");
    expect(feishu.content.text).not.toContain("secret-acc-123");
    expect(feishu.content.text).not.toContain("fan@example.com");
    expect(feishu.content.text).not.toContain("free-text personal reason");
    expect(feishu.content.text).not.toContain("198.51.100.1");

    const wecom = buildOpsAlertPayload("wecom", event) as { msgtype: string; text: { content: string } };
    expect(wecom.msgtype).toBe("text");
    expect(wecom.text.content).toContain("kind=account_deletion");

    const generic = buildOpsAlertPayload("generic", event) as {
      event: string;
      severity: string;
      metadata: Record<string, unknown>;
    };
    expect(generic.event).toBe("account_deletion_requested");
    expect(generic.severity).toBe("warning");
    expect(generic.metadata).toEqual({
      privacyRequestId: "priv-1",
      kind: "account_deletion",
      requestId: "req-1",
    });
  });
});

describe("OpsAlertService", () => {
  it("stays a no-op when OPS_ALERT_WEBHOOK_URL is unset", async () => {
    let calls = 0;
    const { logger } = recordingLogger();
    const service = new OpsAlertService(
      configStub(),
      logger as never,
      undefined,
      {
        fetch: () => {
          calls += 1;
          return Promise.resolve(new Response(null, { status: 204 }));
        },
      },
    );

    await service.notify({
      severity: "critical",
      category: "api_5xx",
      title: "API 5xx 错误",
      summary: "GET /api/v2/x (500)",
    });

    expect(calls).toBe(0);
  });

  it("deduplicates repeated alerts inside cooldown and delivers again after expiry", async () => {
    let now = 1_000;
    const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
    const { logger } = recordingLogger();
    const service = new OpsAlertService(
      configStub({ opsAlertWebhookUrl: "https://hooks.example.test/feishu", opsAlertWebhookFormat: "feishu" }),
      logger as never,
      undefined,
      {
        now: () => now,
        fetch: (url, init) => {
          sent.push({ url, body: parseJsonBody(init.body) });
          return Promise.resolve(new Response(null, { status: 200 }));
        },
      },
    );

    const event = {
      severity: "critical" as const,
      category: "api_5xx" as const,
      title: "API 5xx 错误",
      summary: "POST /api/v2/x (500)",
      dedupeKey: "5xx:POST:/api/v2/x:system.internal",
      cooldownMs: 300_000,
    };

    await service.notify(event);
    await service.notify(event);
    now += 299_999;
    await service.notify(event);
    expect(sent).toHaveLength(1);

    now += 1;
    await service.notify(event);
    expect(sent).toHaveLength(2);
  });

  it("bounds its cooldown map across more than 500 distinct keys", async () => {
    let now = 10_000;
    let deliveries = 0;
    const { logger } = recordingLogger();
    const service = new OpsAlertService(
      configStub({ opsAlertWebhookUrl: "https://hooks.example.test/generic", opsAlertWebhookFormat: "generic" }),
      logger as never,
      undefined,
      {
        now: () => now,
        fetch: () => {
          deliveries += 1;
          return Promise.resolve(new Response(null, { status: 200 }));
        },
      },
    );

    for (let index = 0; index < 510; index += 1) {
      await service.notify({
        severity: "critical",
        category: "api_5xx",
        title: "API 5xx 错误",
        summary: `route-${index}`,
        dedupeKey: `5xx:/r/${index}`,
        cooldownMs: 300_000,
      });
    }
    expect(deliveries).toBe(510);

    // Key 0 was evicted when capacity capped at 500, while key 509 stays suppressed.
    await service.notify({
      severity: "critical",
      category: "api_5xx",
      title: "API 5xx 错误",
      summary: "route-509",
      dedupeKey: "5xx:/r/509",
      cooldownMs: 300_000,
    });
    expect(deliveries).toBe(510);

    now += 1;
    await service.notify({
      severity: "critical",
      category: "api_5xx",
      title: "API 5xx 错误",
      summary: "route-0",
      dedupeKey: "5xx:/r/0",
      cooldownMs: 300_000,
    });
    expect(deliveries).toBe(511);
  });

  it("swallows non-2xx responses, network failures, and aborts without throwing", async () => {
    let mode: "status" | "network" | "timeout" = "status";
    const { entries, logger } = recordingLogger();
    const service = new OpsAlertService(
      configStub({ opsAlertWebhookUrl: "https://hooks.example.test/hook" }),
      logger as never,
      undefined,
      {
        timeoutMs: 15,
        fetch: (_url, init) => {
          if (mode === "status") return Promise.resolve(new Response("bad", { status: 502 }));
          if (mode === "network") return Promise.reject(new TypeError("network down"));
          return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          });
        },
      },
    );

    await service.notify({ severity: "critical", category: "api_5xx", title: "t", summary: "s" });
    mode = "network";
    await service.notify({ severity: "critical", category: "api_5xx", title: "t", summary: "s" });
    mode = "timeout";
    await service.notify({ severity: "critical", category: "api_5xx", title: "t", summary: "s" });

    expect(entries).toEqual([
      { level: "warn", message: "Ops alert delivery failed", fields: { category: "api_5xx", status: 502 } },
      { level: "warn", message: "Ops alert delivery failed", fields: { category: "api_5xx", errorName: "TypeError" } },
      { level: "warn", message: "Ops alert delivery failed", fields: { category: "api_5xx", errorName: "AbortError" } },
    ]);
  });

  it("binds Cloudflare waitUntil with the context receiver and uses runtime Worker secrets", async () => {
    const sent: Array<{ url: string; payload: Record<string, unknown> }> = [];
    const { entries, logger } = recordingLogger();
    const runtime = new OpsAlertRuntimeService();
    const service = new OpsAlertService(configStub({ environment: "production" }), logger as never, runtime, {
      fetch: (url, init) => {
        sent.push({ url, payload: parseJsonBody(init.body) });
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });

    const pending: Array<Promise<unknown>> = [];
    const fakeExecutionContext = {
      tag: "cf-ctx",
      waitUntil(this: { tag?: string }, promise: Promise<unknown>) {
        if (this?.tag !== "cf-ctx") throw new TypeError("Illegal invocation");
        pending.push(promise);
      },
    };

    runtime.withContext(
      fakeExecutionContext,
      {
        OPS_ALERT_WEBHOOK_URL: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc",
        OPS_ALERT_WEBHOOK_FORMAT: "wecom",
      },
      () => {
        void service.notify({
          severity: "critical",
          category: "cron_failure",
          title: "定时任务执行失败",
          summary: "Async downstream cycle failed",
        });
      },
    );

    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(sent).toEqual([
      {
        url: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc",
        payload: {
          msgtype: "text",
          text: { content: "[Zhipanda CRITICAL] 定时任务执行失败\nAsync downstream cycle failed" },
        },
      },
    ]);
    expect(entries).toEqual([]);

    // Invalid runtime webhook URL warns once and skips instead of throwing.
    await runtime.withContext(
      fakeExecutionContext,
      { OPS_ALERT_WEBHOOK_URL: "http://insecure.example.com/hook" },
      () => service.notify({ severity: "critical", category: "cron_failure", title: "t", summary: "s" }),
    );
    expect(entries).toEqual([
      { level: "warn", message: "Ops alert configuration is invalid", fields: { errorName: "Error" } },
    ]);
  });
});

describe("Controller ops-alert notifications", () => {
  it("notifies on contribution submission with metadata only (zero PII)", async () => {
    const events: Array<Record<string, unknown>> = [];
    const created: ContributionRecord = {
      submissionId: "sub-1",
      submissionType: "correction",
      targetPandaId: "panda-1",
      publicVersionSeen: "2026.10.31.1",
      revisionNumber: 1,
      status: "submitted",
      submittedAt: new Date("2026-11-22T00:00:00.000Z"),
    };
    const port: ContributionPort = {
      submit: () => Promise.resolve(created),
      listOwn: () => Promise.resolve([]),
      getOwn: () => Promise.resolve(undefined),
      getReviewSurface: () => Promise.resolve(undefined),
    };
    const controller = new ContributionController(
      port,
      { current: { requestId: "req-c1", correlationId: "corr-c1" } } as never,
      {
        notify: (event: Record<string, unknown>) => {
          events.push(event);
          return Promise.resolve();
        },
      } as never,
    );

    const request = { headers: {} } as HttpRequest;
    setActorContext(request, fakeActor("acc-private-1"));

    const result = await controller.submit(request, {
      submissionType: "correction",
      targetPandaId: "panda-1",
      publicVersionSeen: "2026.10.31.1",
      assertions: [],
      sources: [],
    });

    expect(result).toBe(created);
    expect(events).toEqual([
      {
        severity: "info",
        category: "contribution_submitted",
        title: "收到新社区投稿",
        summary: "correction (sub-1)",
        dedupeKey: "contribution:sub-1",
        cooldownMs: 300_000,
        metadata: {
          submissionId: "sub-1",
          submissionType: "correction",
          targetPandaId: "panda-1",
          requestId: "req-c1",
        },
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("acc-private-1");
  });

  it("notifies only on account_deletion privacy requests and omits accountId and reason", async () => {
    const events: Array<Record<string, unknown>> = [];
    const port: PrivacyPort = {
      create: (_accountId, input) =>
        Promise.resolve({
          requestId: input.kind === "account_deletion" ? "priv-del-1" : "priv-exp-1",
          kind: input.kind,
          state: "pending",
          reason: input.reason,
          requestedAt: "2026-11-22T00:00:00.000Z",
          updatedAt: "2026-11-22T00:00:00.000Z",
        } satisfies PrivacyRequestRecord),
      get: () => Promise.resolve(undefined),
      list: () => Promise.resolve([]),
      getExport: () => Promise.resolve(undefined),
    };
    const controller = new PrivacyController(
      port,
      { current: { requestId: "req-p1", correlationId: "corr-p1" } } as never,
      {
        notify: (event: Record<string, unknown>) => {
          events.push(event);
          return Promise.resolve();
        },
      } as never,
    );

    const request = { headers: {} } as HttpRequest;
    setActorContext(request, fakeActor("acc-private-2"));

    await controller.create(request, {
      kind: "access_export",
      reason: "Personal export request with sensitive details",
      idempotencyKey: "idem-1",
    });
    expect(events).toEqual([]);

    await controller.create(request, {
      kind: "account_deletion",
      reason: "Private reason with user@example.com",
      idempotencyKey: "idem-2",
    });
    expect(events).toEqual([
      {
        severity: "warning",
        category: "account_deletion_requested",
        title: "收到账号注销申请",
        summary: "Account deletion request (priv-del-1)",
        dedupeKey: "privacy:priv-del-1",
        cooldownMs: 300_000,
        metadata: {
          privacyRequestId: "priv-del-1",
          kind: "account_deletion",
          requestId: "req-p1",
        },
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("acc-private-2");
    expect(JSON.stringify(events)).not.toContain("user@example.com");
    expect(JSON.stringify(events)).not.toContain("Private reason");
  });
});
