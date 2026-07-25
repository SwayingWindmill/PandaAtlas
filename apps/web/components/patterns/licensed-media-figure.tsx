"use client";

/* eslint-disable @next/next/no-img-element */

import type { Route } from "next";
import Link from "next/link";
import { ExternalLink, ImageOff } from "lucide-react";
import { useState } from "react";
import type { PublicLocale } from "@/foundation/content/locales";

interface LicensedMediaFigureProps {
  locale: PublicLocale;
  variant: "home" | "profile";
  src: string | null;
  srcSet?: string;
  sizes: string;
  width?: number | null;
  height?: number | null;
  alt: string;
  credit?: string | null;
  rights?: string | null;
  sourceUrl?: string | null;
  profileHref?: string | null;
  profileLabel?: string | null;
  fallbackTitle: string;
  fallbackBody: string;
  priority?: boolean;
  testId: string;
}

const copy = {
  zh: {
    credit: "图片署名",
    rights: "许可",
    source: "查看原始来源",
    failed: "图片暂时无法加载",
  },
  en: {
    credit: "Image credit",
    rights: "Licence",
    source: "Open original source",
    failed: "Image could not be loaded",
  },
} as const;

export function LicensedMediaFigure({
  locale,
  variant,
  src,
  srcSet,
  sizes,
  width,
  height,
  alt,
  credit,
  rights,
  sourceUrl,
  profileHref,
  profileLabel,
  fallbackTitle,
  fallbackBody,
  priority = false,
  testId,
}: LicensedMediaFigureProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const t = copy[locale];
  const available = Boolean(src) && !loadFailed;

  return (
    <figure className="pa-licensed-media" data-variant={variant} data-testid={testId}>
      <div className="pa-licensed-media-frame">
        {available ? (
          <img
            src={src!}
            srcSet={srcSet}
            sizes={sizes}
            width={width ?? undefined}
            height={height ?? undefined}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={() => setLoadFailed(true)}
            data-testid={`${testId}-image`}
          />
        ) : (
          <div className="pa-licensed-media-fallback" role={loadFailed ? "status" : undefined} data-testid={`${testId}-fallback`}>
            <ImageOff aria-hidden="true" />
            <strong>{loadFailed ? t.failed : fallbackTitle}</strong>
            <p>{fallbackBody}</p>
          </div>
        )}
      </div>

      <figcaption className="pa-licensed-media-caption">
        <div>
          {profileHref && profileLabel ? (
            <Link href={profileHref as Route} className="pa-licensed-media-profile-link">
              {profileLabel}
            </Link>
          ) : null}
          {credit ? <p><span>{t.credit}</span>{credit}</p> : null}
          {rights ? <p><span>{t.rights}</span>{rights}</p> : null}
        </div>
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="pa-licensed-media-source">
            {t.source}<ExternalLink aria-hidden="true" />
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}
