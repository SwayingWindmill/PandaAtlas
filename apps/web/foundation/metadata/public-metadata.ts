import type { Metadata } from "next";

import {
  localizedPath,
  type PublicLocale,
} from "@/foundation/content/locales";

export const ZHIPANDA_PUBLIC_ORIGIN = new URL("https://www.zhipanda.com");
export const ZHIPANDA_APPLICATION_NAME = "吱熊猫 ZhiPanda";
export const ZHIPANDA_PUBLISHER = "ZhiPanda";

interface PublicMetadataInput {
  locale: PublicLocale;
  title: string;
  description: string;
  path?: string;
  image?: {
    url: string;
    alt: string;
  } | null;
  privatePage?: boolean;
  noFollow?: boolean;
}

function absolutePublicUrl(path: string): string {
  return new URL(path, ZHIPANDA_PUBLIC_ORIGIN).toString();
}

export function buildPublicMetadata({
  locale,
  title,
  description,
  path = "",
  image,
  privatePage = false,
  noFollow = false,
}: PublicMetadataInput): Metadata {
  const canonicalPath = localizedPath(locale, path);
  const canonical = absolutePublicUrl(canonicalPath);
  const chinese = absolutePublicUrl(localizedPath("zh", path));
  const english = absolutePublicUrl(localizedPath("en", path));
  const images = image ? [{ url: image.url, alt: image.alt }] : undefined;

  return {
    title: { absolute: title },
    description,
    applicationName: ZHIPANDA_APPLICATION_NAME,
    authors: [{ name: ZHIPANDA_PUBLISHER, url: ZHIPANDA_PUBLIC_ORIGIN }],
    creator: ZHIPANDA_PUBLISHER,
    publisher: ZHIPANDA_PUBLISHER,
    alternates: {
      canonical,
      languages: {
        "zh-CN": chinese,
        en: english,
        "x-default": chinese,
      },
    },
    robots: privatePage
      ? { index: false, follow: !noFollow, nocache: true, noarchive: true }
      : undefined,
    openGraph: privatePage
      ? undefined
      : {
          type: "website",
          url: canonical,
          title,
          description,
          siteName: ZHIPANDA_PUBLISHER,
          locale: locale === "zh" ? "zh_CN" : "en_US",
          alternateLocale: locale === "zh" ? ["en_US"] : ["zh_CN"],
          images,
        },
    twitter: privatePage
      ? undefined
      : {
          card: image ? "summary_large_image" : "summary",
          title,
          description,
          images: image ? [image.url] : undefined,
        },
  };
}
