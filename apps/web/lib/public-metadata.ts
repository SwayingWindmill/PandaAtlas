import type { Metadata } from "next";

import {
  localizedPath,
  type PublicLocale,
} from "@/lib/locales";

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
  /** The page exists in this locale only, so no language alternates are advertised. */
  singleLocale?: boolean;
}

export const DEFAULT_SHARE_IMAGE = {
  url: "/og-default.png",
  width: 1200,
  height: 630,
  alt: "吱熊猫 ZhiPanda",
} as const;

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
  singleLocale = false,
}: PublicMetadataInput): Metadata {
  const canonicalPath = localizedPath(locale, path);
  const canonical = absolutePublicUrl(canonicalPath);
  const chinese = absolutePublicUrl(localizedPath("zh", path));
  const english = absolutePublicUrl(localizedPath("en", path));
  const images = image ? [{ url: image.url, alt: image.alt }] : [DEFAULT_SHARE_IMAGE];

  return {
    title: { absolute: title },
    description,
    applicationName: ZHIPANDA_APPLICATION_NAME,
    authors: [{ name: ZHIPANDA_PUBLISHER, url: ZHIPANDA_PUBLIC_ORIGIN.toString() }],
    creator: ZHIPANDA_PUBLISHER,
    publisher: ZHIPANDA_PUBLISHER,
    alternates: {
      canonical,
      languages: singleLocale
        ? undefined
        : {
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
          alternateLocale: singleLocale ? undefined : locale === "zh" ? ["en_US"] : ["zh_CN"],
          images,
        },
    twitter: privatePage
      ? undefined
      : {
          card: "summary_large_image",
          title,
          description,
          images: images.map((item) => item.url),
        },
  };
}
