import type { PublicLocale } from "@/foundation/content/locales";

export type PublicSearchParams = Record<string, string | string[] | undefined>;

export function serializePublicSearchParams(searchParams: PublicSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function localizedPublicDestination(
  locale: PublicLocale,
  path: string,
  searchParams: PublicSearchParams = {},
): string {
  const normalizedPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalizedPath}${serializePublicSearchParams(searchParams)}`;
}
