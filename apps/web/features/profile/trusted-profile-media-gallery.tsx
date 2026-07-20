"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type {
  TrustedProfileMediaItemViewModel,
  TrustedProfileMediaViewModel,
} from "@/features/profile/profile-page-view-model";

interface TrustedProfileMediaGalleryProps {
  locale: "zh" | "en";
  media: TrustedProfileMediaViewModel;
}

const copy = {
  zh: {
    imageFailed: "影像加载失败",
    imageFailedBody: "可信文字档案仍然可用。页面不会替换为其他熊猫或通用图片。",
    withdrawn: "影像已撤回",
    withdrawnBody: "这张影像仍保留来源与许可记录，但不再公开显示图片。",
    unavailable: "影像不可用",
    unavailableBody: "当前发布版本没有可显示的图片地址。",
    credit: "署名",
    rights: "使用权",
    source: "原始来源",
  },
  en: {
    imageFailed: "Image failed to load",
    imageFailedBody: "The trusted text profile remains available. No other panda or generic image is substituted.",
    withdrawn: "Image withdrawn",
    withdrawnBody: "The source and rights record remains visible, but the image is no longer displayed.",
    unavailable: "Image unavailable",
    unavailableBody: "This public release has no displayable image URL for the item.",
    credit: "Credit",
    rights: "Rights",
    source: "Original source",
  },
} as const;

function MediaMetadata({
  item,
  locale,
}: {
  item: TrustedProfileMediaItemViewModel;
  locale: "zh" | "en";
}) {
  const t = copy[locale];
  return (
    <dl className="grid gap-2 border-t border-[var(--pa-color-accent-border-09)] px-5 py-4 text-sm">
      {item.credit ? (
        <div>
          <dt className="inline text-[var(--muted)]">{t.credit}: </dt>
          <dd className="inline font-medium">{item.credit}</dd>
        </div>
      ) : null}
      {item.rights ? (
        <div>
          <dt className="inline text-[var(--muted)]">{t.rights}: </dt>
          <dd className="inline font-medium">{item.rights}</dd>
        </div>
      ) : null}
      {item.sourceUrl ? (
        <div>
          <dt className="sr-only">{t.source}</dt>
          <dd>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-semibold text-[var(--accent)] hover:underline"
            >
              {t.source}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function MediaItem({
  item,
  locale,
}: {
  item: TrustedProfileMediaItemViewModel;
  locale: "zh" | "en";
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const t = copy[locale];
  const srcSet = item.derivatives.length
    ? item.derivatives.map((derivative) => `${derivative.url} ${derivative.width}w`).join(", ")
    : undefined;
  const available = item.status === "available" && Boolean(item.url) && !loadFailed;
  const statusTitle = loadFailed
    ? t.imageFailed
    : item.status === "withdrawn"
      ? t.withdrawn
      : t.unavailable;
  const statusBody = loadFailed
    ? t.imageFailedBody
    : item.status === "withdrawn"
      ? t.withdrawnBody
      : t.unavailableBody;

  return (
    <article
      className="overflow-hidden rounded-2xl border border-[var(--pa-color-accent-border-09)] bg-[var(--surface)]"
      data-testid="media-item"
    >
      {available ? (
        <img
          src={item.url!}
          srcSet={srcSet}
          sizes="(min-width: 1024px) 50vw, 100vw"
          width={item.width ?? undefined}
          height={item.height ?? undefined}
          alt={item.alt}
          loading="lazy"
          decoding="async"
          className="aspect-[3/2] w-full object-cover"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex min-h-64 flex-col justify-center bg-[var(--pa-color-accent-fill-05)] p-8"
          role="status"
          aria-live={loadFailed ? "polite" : undefined}
          data-testid={loadFailed
            ? "media-load-error"
            : item.status === "withdrawn"
              ? "media-withdrawn-state"
              : "media-unavailable-state"}
        >
          <p className="text-xl font-semibold">{statusTitle}</p>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{statusBody}</p>
        </div>
      )}
      <MediaMetadata item={item} locale={locale} />
    </article>
  );
}

export function TrustedProfileMediaGallery({ locale, media }: TrustedProfileMediaGalleryProps) {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2" data-testid="media-gallery">
      {media.items.map((item) => (
        <MediaItem key={item.id} item={item} locale={locale} />
      ))}
    </div>
  );
}
