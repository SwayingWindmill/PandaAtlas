import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";

// Crash reports go to Sentry's envelope endpoint over plain fetch, so the app carries no native SDK yet.
// Without EXPO_PUBLIC_SENTRY_DSN (local runs, e2e, builds that have not opted in) nothing is sent.

export type ErrorSource = "error-boundary" | "global" | "fatal" | "query" | "mutation" | "ota";

interface SentryTarget {
  url: string;
  dsn: string;
}

/** The envelope URL for a DSN of the form `https://<key>@<host>/<project>`, or null if it is not one. */
export function sentryTarget(dsn: string | undefined): SentryTarget | null {
  if (!dsn) return null;
  let parsed: URL;
  try {
    parsed = new URL(dsn);
  } catch {
    return null;
  }
  const projectId = parsed.pathname.replace(/^\/+|\/+$/g, "");
  if (!parsed.username || !projectId) return null;
  const query = `sentry_key=${encodeURIComponent(parsed.username)}&sentry_version=7`;
  return { url: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/?${query}`, dsn };
}

export function sentryEnvelope(
  error: unknown,
  meta: { dsn: string; eventId: string; now: Date; source: ErrorSource; release: string; os: string },
): string {
  const failure = error instanceof Error ? error : new Error(String(error));
  const event = {
    event_id: meta.eventId,
    timestamp: meta.now.getTime() / 1000,
    platform: "javascript",
    level: meta.source === "fatal" ? "fatal" : "error",
    release: meta.release,
    environment: __DEV__ ? "development" : "production",
    tags: { source: meta.source, os: meta.os },
    exception: { values: [{ type: failure.name, value: failure.message }] },
    extra: { stack: failure.stack },
  };
  return [
    JSON.stringify({ event_id: meta.eventId, dsn: meta.dsn, sent_at: meta.now.toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

const target = sentryTarget(process.env.EXPO_PUBLIC_SENTRY_DSN);

export function reportError(error: unknown, source: ErrorSource): void {
  if (!target) return;
  const body = sentryEnvelope(error, {
    dsn: target.dsn,
    eventId: randomUUID().replace(/-/g, ""),
    now: new Date(),
    source,
    release: `zhipanda-mobile@${Constants.expoConfig?.version ?? "unknown"}`,
    os: Platform.OS,
  });
  // A report that cannot be delivered is dropped: reporting must never become a second failure.
  void fetch(target.url, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope" }, body }).catch(
    () => undefined,
  );
}

let installed = false;

/** Reports uncaught JS errors on native, then hands them to React Native's own handler (the red box, or the crash). */
export function installGlobalErrorReporting(): void {
  // Fast Refresh re-runs the root layout's module; wrapping the handler again would report each error twice.
  if (installed || typeof ErrorUtils === "undefined") return;
  installed = true;
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      reportError(error, isFatal ? "fatal" : "global");
    } finally {
      previous(error, isFatal);
    }
  });
}
