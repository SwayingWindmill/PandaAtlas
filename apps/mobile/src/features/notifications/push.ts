import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { isDevice } from "expo-device";
import {
  addNotificationResponseReceivedListener,
  AndroidImportance,
  getExpoPushTokenAsync,
  getLastNotificationResponseAsync,
  getPermissionsAsync,
  IosAuthorizationStatus,
  type NotificationPermissionsStatus,
  type NotificationResponse,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useSession } from "@/features/session/session";
import { reportError } from "@/lib/error-reporting";

import { markRead, registerNotificationDevice, removeNotificationDevice } from "./inbox";
import { resolveNotificationHref } from "./push-routing";

const PUSH_DEVICE_KEY = "zhipanda.push.device.v1";

interface StoredPushDevice {
  accountId: string;
  deviceTokenId: string;
  expoPushToken: string;
}

export type PushRegistrationOutcome = "registered" | "denied" | "undetermined" | "unsupported" | "failed";
export type PushPermissionState = "granted" | "promptable" | "denied" | "unsupported";

let handlerInstalled = false;
let lastRegisteredSessionToken: string | null = null;

function nativePushPlatform(): "ios" | "android" | null {
  if (Platform.OS === "ios" || Platform.OS === "android") return Platform.OS;
  return null;
}

function ensureNotificationHandler(): void {
  if (handlerInstalled || nativePushPlatform() === null) return;
  handlerInstalled = true;
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function resolveEasProjectId(): string | null {
  const extra: unknown = Constants.expoConfig?.extra;
  if (typeof extra === "object" && extra !== null && "eas" in extra) {
    const eas = extra.eas;
    if (typeof eas === "object" && eas !== null && "projectId" in eas && typeof eas.projectId === "string") {
      const trimmed = eas.projectId.trim();
      if (trimmed !== "") return trimmed;
    }
  }
  const fallback = Constants.easConfig?.projectId;
  return typeof fallback === "string" && fallback.trim() !== "" ? fallback.trim() : null;
}

function hasGrantedPermission(status: NotificationPermissionsStatus): boolean {
  return status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

function parseStoredDevice(raw: string | null): StoredPushDevice | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    reportError(error, "global");
    return null;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "accountId" in parsed &&
    "deviceTokenId" in parsed &&
    "expoPushToken" in parsed &&
    typeof parsed.accountId === "string" &&
    typeof parsed.deviceTokenId === "string" &&
    typeof parsed.expoPushToken === "string"
  ) {
    return {
      accountId: parsed.accountId,
      deviceTokenId: parsed.deviceTokenId,
      expoPushToken: parsed.expoPushToken,
    };
  }
  return null;
}

export async function checkNativePushPermission(): Promise<PushPermissionState> {
  if (nativePushPlatform() === null || !isDevice) return "unsupported";
  try {
    const status = await getPermissionsAsync();
    if (hasGrantedPermission(status)) return "granted";
    return status.canAskAgain ? "promptable" : "denied";
  } catch (error) {
    reportError(error, "global");
    return "unsupported";
  }
}

export async function registerPushDeviceForAccount(
  accountId: string,
  options: { promptPermission: boolean },
): Promise<PushRegistrationOutcome> {
  const platform = nativePushPlatform();
  if (platform === null || !isDevice) return "unsupported";

  try {
    ensureNotificationHandler();
    if (platform === "android") {
      await setNotificationChannelAsync("default", {
        name: "默认通知",
        importance: AndroidImportance.DEFAULT,
      });
    }

    let status = await getPermissionsAsync();
    if (!hasGrantedPermission(status)) {
      if (!options.promptPermission) return "undetermined";
      status = await requestPermissionsAsync();
      if (!hasGrantedPermission(status)) return "denied";
    }

    const projectId = resolveEasProjectId();
    if (!projectId) {
      reportError(new Error("Missing EAS projectId for Expo push token registration"), "mutation");
      return "failed";
    }

    const token = await getExpoPushTokenAsync({ projectId });
    const sessionKey = `${accountId}:${token.data}`;
    if (lastRegisteredSessionToken === sessionKey) return "registered";

    const saved = await registerNotificationDevice(token.data, platform);
    const record: StoredPushDevice = {
      accountId,
      deviceTokenId: saved.deviceTokenId,
      expoPushToken: saved.expoPushToken,
    };
    await AsyncStorage.setItem(PUSH_DEVICE_KEY, JSON.stringify(record));
    lastRegisteredSessionToken = sessionKey;
    return "registered";
  } catch (error) {
    reportError(error, "mutation");
    return "failed";
  }
}

export async function unregisterStoredPushDevice(): Promise<void> {
  lastRegisteredSessionToken = null;
  if (nativePushPlatform() === null) return;

  try {
    const stored = parseStoredDevice(await AsyncStorage.getItem(PUSH_DEVICE_KEY));
    if (stored) {
      await removeNotificationDevice(stored.deviceTokenId);
    }
  } catch (error) {
    reportError(error, "mutation");
  } finally {
    await AsyncStorage.removeItem(PUSH_DEVICE_KEY);
  }
}

function responseData(response: NotificationResponse): Record<string, unknown> | null {
  const raw: unknown = response.notification.request.content.data;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  return Object.fromEntries(entries);
}

export function usePushNotifications(): void {
  const { state: session } = useSession();
  const signedInAccountId = session.status === "signedIn" ? session.accountId : null;
  const handledIdsRef = useRef<Set<string>>(new Set());
  const accountIdRef = useRef<string | null>(signedInAccountId);
  const pendingReadMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    accountIdRef.current = signedInAccountId;
  }, [signedInAccountId]);

  useEffect(() => {
    if (!signedInAccountId) return;
    void registerPushDeviceForAccount(signedInAccountId, { promptPermission: false });
    const pendingMessageId = pendingReadMessageIdRef.current;
    if (pendingMessageId) {
      pendingReadMessageIdRef.current = null;
      void markRead(pendingMessageId).catch((error) => reportError(error, "mutation"));
    }
  }, [signedInAccountId]);

  useEffect(() => {
    if (nativePushPlatform() === null) return;
    ensureNotificationHandler();

    const handleResponse = (response: NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledIdsRef.current.has(id)) return;
      handledIdsRef.current.add(id);

      const data = responseData(response);
      const href = resolveNotificationHref(data) ?? "/notifications";
      router.push(href);

      const messageId = data && typeof data.messageId === "string" ? data.messageId : null;
      if (messageId) {
        if (accountIdRef.current) {
          void markRead(messageId).catch((error) => reportError(error, "mutation"));
        } else {
          pendingReadMessageIdRef.current = messageId;
        }
      }
    };

    void getLastNotificationResponseAsync()
      .then(handleResponse)
      .catch((error) => reportError(error, "global"));

    const subscription = addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, []);
}
