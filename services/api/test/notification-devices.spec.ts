import { validate } from "class-validator";
import type { IncomingMessage as HttpRequest } from "node:http";
import { describe, expect, it } from "vitest";
import type { ActorContext } from "../src/modules/identity/application/identity-access.types.js";
import { setActorContext } from "../src/modules/identity/http/request-actor.js";
import {
  NotificationApplication,
  isValidExpoPushToken,
  type NotificationDevicePlatform,
  type NotificationDeviceToken,
  type NotificationRepository,
} from "../src/modules/notification/application/notification.application.js";
import { NotificationController } from "../src/modules/notification/http/notification.controller.js";
import {
  NotificationDeviceInputDto,
  NotificationPreferenceInputDto,
} from "../src/modules/notification/http/notification.dto.js";
import { DomainError } from "../src/platform/errors/domain-error.js";
import { ProblemException } from "../src/platform/http/problem.exception.js";

function actorRequest(accountId: string): HttpRequest {
  const actor: ActorContext = {
    accountId,
    sessionId: "sess-1",
    aal: "aal1",
    authenticatedAt: new Date(),
    authenticationMethod: "otp",
    capabilities: new Set(["notification.read", "notification.manage"]),
  };
  const req = {} as HttpRequest;
  setActorContext(req, actor);
  return req;
}

type StoredDevice = NotificationDeviceToken & { accountId: string };

function toPublicDevice(record: StoredDevice): NotificationDeviceToken {
  return {
    deviceTokenId: record.deviceTokenId,
    expoPushToken: record.expoPushToken,
    platform: record.platform,
    active: record.active,
    lastActiveAt: record.lastActiveAt,
    updatedAt: record.updatedAt,
  };
}

function memoryRepo(): NotificationRepository {
  const devices = new Map<string, StoredDevice>();
  let seq = 0;

  return {
    listMessages: () => Promise.resolve([]),
    markRead: () => Promise.resolve(undefined),
    markAllRead: () => Promise.resolve(0),
    listPreferences: () => Promise.resolve([]),
    setPreference: (_accountId, category, channel, enabled) =>
      Promise.resolve({
        category,
        channel,
        enabled,
        version: 1,
        updatedAt: new Date().toISOString(),
      }),
    listDevices: (accountId) =>
      Promise.resolve([...devices.values()].filter((item) => item.accountId === accountId).map(toPublicDevice)),
    registerDevice: (accountId, expoPushToken, platform: NotificationDevicePlatform) => {
      const existing = [...devices.values()].find((item) => item.expoPushToken === expoPushToken);
      const now = new Date().toISOString();
      if (existing !== undefined) {
        const updated: StoredDevice = {
          ...existing,
          accountId,
          platform,
          active: true,
          lastActiveAt: now,
          updatedAt: now,
        };
        devices.set(existing.deviceTokenId, updated);
        return Promise.resolve(toPublicDevice(updated));
      }
      seq += 1;
      const deviceTokenId = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
      const record: StoredDevice = {
        accountId,
        deviceTokenId,
        expoPushToken,
        platform,
        active: true,
        lastActiveAt: now,
        updatedAt: now,
      };
      devices.set(deviceTokenId, record);
      return Promise.resolve(toPublicDevice(record));
    },
    removeDevice: (accountId, deviceTokenId) => {
      const found = devices.get(deviceTokenId);
      if (found === undefined || found.accountId !== accountId) return Promise.resolve(false);
      devices.delete(deviceTokenId);
      return Promise.resolve(true);
    },
  };
}

describe("Notification device registration and push channel contracts", () => {
  it("validates Expo push token format strictly", () => {
    expect(isValidExpoPushToken("ExponentPushToken[Abc_123-xyz]")).toBe(true);
    expect(isValidExpoPushToken("ExpoPushToken[device:token/1=+]")).toBe(true);
    expect(isValidExpoPushToken("")).toBe(false);
    expect(isValidExpoPushToken("fcm-raw-token")).toBe(false);
    expect(isValidExpoPushToken("ExponentPushToken[bad space]")).toBe(false);
    expect(isValidExpoPushToken(`ExponentPushToken[${"a".repeat(250)}]`)).toBe(false);
  });

  it("validates NotificationDeviceInputDto and NotificationPreferenceInputDto via class-validator", async () => {
    const validDevice = new NotificationDeviceInputDto();
    validDevice.expoPushToken = "ExponentPushToken[device-123]";
    validDevice.platform = "ios";
    expect(await validate(validDevice)).toHaveLength(0);

    const invalidDevice = new NotificationDeviceInputDto();
    invalidDevice.expoPushToken = "not-an-expo-token";
    invalidDevice.platform = "web" as "ios";
    expect((await validate(invalidDevice)).length).toBeGreaterThanOrEqual(2);

    const pushPref = new NotificationPreferenceInputDto();
    pushPref.category = "knowledge_update";
    pushPref.channel = "push";
    pushPref.enabled = true;
    expect(await validate(pushPref)).toHaveLength(0);
  });

  it("lists, registers, transfers ownership cleanly, and removes device tokens via NotificationController", async () => {
    const app = new NotificationApplication(memoryRepo());
    const controller = new NotificationController(app);

    const reqA = actorRequest("acc-a");
    const reqB = actorRequest("acc-b");

    const dtoA = new NotificationDeviceInputDto();
    dtoA.expoPushToken = "ExponentPushToken[shared-phone]";
    dtoA.platform = "ios";

    const registeredA = await controller.registerDevice(reqA, dtoA);
    expect(registeredA.active).toBe(true);
    expect(await controller.listDevices(reqA)).toHaveLength(1);

    // Signing into another account on the same physical phone reassigns ownership to acc-b.
    const registeredB = await controller.registerDevice(reqB, dtoA);
    expect(registeredB.deviceTokenId).toBe(registeredA.deviceTokenId);
    expect(await controller.listDevices(reqA)).toHaveLength(0);
    expect(await controller.listDevices(reqB)).toHaveLength(1);

    await expect(controller.removeDevice(reqA, registeredB.deviceTokenId)).rejects.toBeInstanceOf(ProblemException);
    await expect(controller.removeDevice(reqB, registeredB.deviceTokenId)).resolves.toEqual({
      deviceTokenId: registeredB.deviceTokenId,
      removed: true,
    });
    expect(await controller.listDevices(reqB)).toHaveLength(0);

    await expect(app.registerDevice("acc-a", "invalid-token", "android")).rejects.toBeInstanceOf(DomainError);
  });
});
