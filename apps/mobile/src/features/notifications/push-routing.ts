import type { Href } from "expo-router";

const SAFE_SLUG = /^[a-z0-9-]+$/i;

function safeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return SAFE_SLUG.test(trimmed) ? trimmed : null;
}

function matchAllowedRoute(route: unknown): Href | null {
  if (typeof route !== "string") return null;
  const trimmed = route.trim();
  if (trimmed === "/birthdays") return "/birthdays";
  if (trimmed === "/venue-news") return "/venue-news";
  if (trimmed === "/notifications") return "/notifications";
  const pandaMatch = /^\/pandas\/([a-z0-9-]+)$/i.exec(trimmed);
  if (pandaMatch?.[1]) return `/pandas/${pandaMatch[1]}`;
  const instMatch = /^\/institutions\/([a-z0-9-]+)$/i.exec(trimmed);
  if (instMatch?.[1]) return `/institutions/${instMatch[1]}`;
  return null;
}

function pandaRoute(
  data: Record<string, unknown>,
  idField: "pandaId" | "resourceId",
  pandaSlugById?: (id: string) => string | null,
): Href | null {
  const directSlug = safeSlug(data.pandaSlug);
  if (directSlug !== null) return `/pandas/${directSlug}`;
  const rawId = data[idField];
  if (typeof rawId === "string" && pandaSlugById) {
    const resolved = safeSlug(pandaSlugById(rawId));
    if (resolved !== null) return `/pandas/${resolved}`;
  }
  return null;
}

export function resolveNotificationHref(
  data: Record<string, unknown> | null | undefined,
  pandaSlugById?: (id: string) => string | null,
): Href | null {
  if (!data) return null;
  const direct = matchAllowedRoute(data.route);
  if (direct !== null) return direct;

  if (data.kind === "birthday_reminder") {
    return pandaRoute(data, "pandaId", pandaSlugById) ?? "/birthdays";
  }
  if (data.kind === "panda_news") {
    return pandaRoute(data, "pandaId", pandaSlugById) ?? "/notifications";
  }
  if (data.kind === "venue_news") {
    const instSlug = safeSlug(data.institutionSlug);
    return instSlug !== null ? `/institutions/${instSlug}` : "/venue-news";
  }
  if (data.kind === "publication_control") {
    return data.action === "restored" ? pandaRoute(data, "resourceId", pandaSlugById) ?? "/notifications" : null;
  }
  if (data.kind === "knowledge_update" || typeof data.messageId === "string") {
    return "/notifications";
  }
  return null;
}
