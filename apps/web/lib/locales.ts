export const PUBLIC_LOCALES = ["zh", "en"] as const;

export type PublicLocale = (typeof PUBLIC_LOCALES)[number];

export function parsePublicLocale(value: string): PublicLocale | null {
  return PUBLIC_LOCALES.includes(value as PublicLocale) ? (value as PublicLocale) : null;
}

export function publicLanguageTag(locale: PublicLocale): "zh-CN" | "en" {
  return locale === "zh" ? "zh-CN" : "en";
}

export function localizedPath(locale: PublicLocale, path = ""): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

export function alternateLocale(locale: PublicLocale): PublicLocale {
  return locale === "zh" ? "en" : "zh";
}

export function defaultPublicLocale(): PublicLocale {
  return "zh";
}

export function resolvePreferredPublicLocale(acceptLanguage: string | null | undefined): PublicLocale {
  if (!acceptLanguage) return defaultPublicLocale();

  const candidates = acceptLanguage
    .split(",")
    .map((entry, index) => {
      const [rawTag, ...parameters] = entry.trim().split(";");
      const tag = rawTag.toLocaleLowerCase();
      const locale: PublicLocale | null = tag === "zh" || tag.startsWith("zh-")
        ? "zh"
        : tag === "en" || tag.startsWith("en-")
          ? "en"
          : null;
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const parsedQuality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1;
      return {
        locale,
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
        index,
      };
    })
    .filter((candidate): candidate is { locale: PublicLocale; quality: number; index: number } =>
      candidate.locale !== null && candidate.quality > 0,
    )
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  return candidates[0]?.locale ?? defaultPublicLocale();
}
