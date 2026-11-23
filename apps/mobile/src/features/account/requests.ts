import { queryOptions } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { shareAsync } from "expo-sharing";
import { Platform } from "react-native";

import { authedApi } from "@/lib/api";
import { downloadOnWeb } from "@/lib/download";

import { type PrivacyKind, type PrivacyRequest, exportFileName } from "./privacy";

/** The API wants a recent email-code verification before privacy requests. */
export class VerificationRequired extends Error {
  public constructor() {
    super("Recent verification required");
    this.name = "VerificationRequired";
  }
}

function throwIfUnverified(error: unknown): void {
  const code = (error as { code?: unknown } | undefined)?.code;
  if (code === "auth.recentAuthRequired") throw new VerificationRequired();
}

export async function loadPrivacyRequests(): Promise<PrivacyRequest[]> {
  const { data, error } = await authedApi.GET("/api/v2/me/privacy/requests");
  throwIfUnverified(error);
  if (!data) throw new Error("Privacy requests unavailable");
  return data.items;
}

export const privacyRequestsQueryKey = (accountId: string) => ["private", accountId, "privacy-requests"] as const;

/**
 * Nothing outlives the screen (`gcTime: 0`): the list sits behind a recent verification, so a cached copy
 * must not show before the API has checked it again. A lapsed verification is not worth a retry.
 */
export function privacyRequestsQueryOptions(accountId: string) {
  return queryOptions({
    queryKey: privacyRequestsQueryKey(accountId),
    queryFn: loadPrivacyRequests,
    staleTime: 0,
    gcTime: 0,
    retry: (count, error) => !(error instanceof VerificationRequired) && count < 1,
  });
}

/** A key for one request the fan means to file; send it again on a retry so the API files it once. */
export function newRequestKey(): string {
  return randomUUID();
}

export async function createPrivacyRequest(kind: PrivacyKind, reason: string, idempotencyKey: string): Promise<PrivacyRequest> {
  const { data, error } = await authedApi.POST("/api/v2/me/privacy/requests", {
    body: { kind, reason, idempotencyKey },
  });
  throwIfUnverified(error);
  if (!data) throw new Error("Privacy request not created");
  return data;
}

/** Fetches a completed export and hands it to the fan as a JSON file: a download on web, the share sheet on phones. */
export async function saveExport(requestId: string): Promise<void> {
  const { data, error } = await authedApi.GET("/api/v2/me/privacy/requests/{requestId}/export", {
    params: { path: { requestId } },
  });
  throwIfUnverified(error);
  if (!data) throw new Error("Export unavailable");
  const name = exportFileName(data.createdAt);
  const json = JSON.stringify(data.payload, null, 2);

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    downloadOnWeb(url, name);
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(json);
  await shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: name });
}
