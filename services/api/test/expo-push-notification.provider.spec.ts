import { describe, expect, it } from "vitest";
import { NotificationProviderError } from "../src/modules/notification/application/notification-provider.port.js";
import { ExpoPushNotificationProvider } from "../src/modules/notification/infrastructure/expo-push-notification.provider.js";
import type { AppConfig } from "../src/platform/config/app-config.js";

function configStub(options: { expoAccessToken?: string; expoPushEndpoint?: string } = {}): AppConfig {
  return {
    expoAccessToken: options.expoAccessToken,
    expoPushEndpoint: options.expoPushEndpoint ?? "https://exp.host/--/api/v2/push/send",
  } as AppConfig;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestBodyString(init: Parameters<typeof fetch>[1]): string {
  return typeof init?.body === "string" ? init.body : "";
}

describe("ExpoPushNotificationProvider", () => {
  it("sends push payloads with optional Bearer token and collects ticket ids", async () => {
    const requests: Array<{ url: string; headers: Headers; body: unknown }> = [];
    const fetchMock: typeof fetch = (input, init) => {
      requests.push({
        url: requestUrl(input),
        headers: new Headers(init?.headers),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
      return Promise.resolve(jsonResponse({ data: [{ status: "ok", id: "expo-ticket-1" }] }));
    };

    const provider = new ExpoPushNotificationProvider(
      configStub({ expoAccessToken: "secret-expo-token", expoPushEndpoint: "https://push.example.test/send" }),
      fetchMock,
    );

    const result = await provider.sendPush({
      jobId: "job-1",
      toTokens: ["ExponentPushToken[token-1]"],
      title: "关注的熊猫资料更新了",
      body: "2 处变化 版本 2026.11.22.1",
      data: { messageId: "msg-1", category: "knowledge_update" },
    });

    expect(result).toEqual({
      provider: "expo",
      deliveredTicketIds: ["expo-ticket-1"],
      unregisteredTokens: [],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://push.example.test/send");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer secret-expo-token");
    expect(requests[0]?.body).toEqual([
      {
        to: "ExponentPushToken[token-1]",
        title: "关注的熊猫资料更新了",
        body: "2 处变化 版本 2026.11.22.1",
        data: { messageId: "msg-1", category: "knowledge_update" },
        sound: "default",
      },
    ]);
  });

  it("handles mixed ok and DeviceNotRegistered tickets without failing delivery", async () => {
    const fetchMock: typeof fetch = () =>
      Promise.resolve(
        jsonResponse({
          data: [
            { status: "ok", id: "ticket-a" },
            { status: "error", message: "Not registered", details: { error: "DeviceNotRegistered" } },
          ],
        }),
      );

    const provider = new ExpoPushNotificationProvider(configStub(), fetchMock);
    const result = await provider.sendPush({
      jobId: "job-2",
      toTokens: ["ExponentPushToken[ok]", "ExponentPushToken[stale]"],
      title: "Title",
      body: "Body",
      data: {},
    });

    expect(result).toEqual({
      provider: "expo",
      deliveredTicketIds: ["ticket-a"],
      unregisteredTokens: ["ExponentPushToken[stale]"],
    });
  });

  it("returns empty deliveredTicketIds cleanly when all tokens are DeviceNotRegistered", async () => {
    const fetchMock: typeof fetch = () =>
      Promise.resolve(
        jsonResponse({
          data: [{ status: "error", message: "Not registered", details: { error: "DeviceNotRegistered" } }],
        }),
      );

    const provider = new ExpoPushNotificationProvider(configStub(), fetchMock);
    await expect(
      provider.sendPush({
        jobId: "job-3",
        toTokens: ["ExponentPushToken[stale]"],
        title: "Title",
        body: "Body",
        data: {},
      }),
    ).resolves.toEqual({
      provider: "expo",
      deliveredTicketIds: [],
      unregisteredTokens: ["ExponentPushToken[stale]"],
    });
  });

  it("classifies retryable and terminal Expo failures accurately", async () => {
    const rateLimited = new ExpoPushNotificationProvider(configStub(), () =>
      Promise.resolve(
        jsonResponse({ data: [{ status: "error", message: "Slow down", details: { error: "MessageRateExceeded" } }] }),
      ),
    );
    await expect(
      rateLimited.sendPush({ jobId: "j1", toTokens: ["ExponentPushToken[a]"], title: "T", body: "B", data: {} }),
    ).rejects.toMatchObject({ code: "expo_rate_limited", retryable: true });

    const serverError = new ExpoPushNotificationProvider(configStub(), () => Promise.resolve(jsonResponse({}, 503)));
    await expect(
      serverError.sendPush({ jobId: "j2", toTokens: ["ExponentPushToken[a]"], title: "T", body: "B", data: {} }),
    ).rejects.toMatchObject({ code: "expo_http_503", retryable: true });

    const badRequest = new ExpoPushNotificationProvider(configStub(), () =>
      Promise.resolve(jsonResponse({ errors: [] }, 400)),
    );
    await expect(
      badRequest.sendPush({ jobId: "j3", toTokens: ["ExponentPushToken[a]"], title: "T", body: "B", data: {} }),
    ).rejects.toMatchObject({ code: "expo_http_400", retryable: false });

    const invalidCreds = new ExpoPushNotificationProvider(configStub(), () =>
      Promise.resolve(
        jsonResponse({
          data: [{ status: "error", message: "Invalid creds", details: { error: "InvalidCredentials" } }],
        }),
      ),
    );
    await expect(
      invalidCreds.sendPush({ jobId: "j4", toTokens: ["ExponentPushToken[a]"], title: "T", body: "B", data: {} }),
    ).rejects.toMatchObject({ code: "expo_invalid_credentials", retryable: false });

    const transportError = new ExpoPushNotificationProvider(configStub(), () =>
      Promise.reject(new Error("socket hang up")),
    );
    await expect(
      transportError.sendPush({ jobId: "j5", toTokens: ["ExponentPushToken[a]"], title: "T", body: "B", data: {} }),
    ).rejects.toBeInstanceOf(NotificationProviderError);
  });

  it("chunks token batches above 100 per Expo API request", async () => {
    const chunkSizes: number[] = [];
    const fetchMock: typeof fetch = (_url, init) => {
      const payload = JSON.parse(requestBodyString(init)) as Array<{ to: string }>;
      chunkSizes.push(payload.length);
      return Promise.resolve(
        jsonResponse({
          data: payload.map((item, idx) => ({ status: "ok", id: `t-${chunkSizes.length}-${idx}-${item.to}` })),
        }),
      );
    };

    const provider = new ExpoPushNotificationProvider(configStub(), fetchMock);
    const tokens = Array.from({ length: 120 }, (_, i) => `ExponentPushToken[device-${i}]`);
    const result = await provider.sendPush({ jobId: "j-chunk", toTokens: tokens, title: "T", body: "B", data: {} });

    expect(chunkSizes).toEqual([100, 20]);
    expect(result.deliveredTicketIds).toHaveLength(120);
  });
});
