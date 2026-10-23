import { Database, TriangleAlert } from "lucide-react";
import type {
  PublicCoverage,
  PublicDelivery,
  PublicLocaleDelivery,
  PublicReleaseIdentity,
} from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";

interface PublicDeliveryNoticeProps {
  locale: PublicLocale;
  release: PublicReleaseIdentity;
  delivery: PublicDelivery;
  coverage: PublicCoverage;
  localeDelivery: PublicLocaleDelivery;
}

export function PublicDeliveryNotice({
  locale,
  release,
  delivery,
  coverage,
  localeDelivery,
}: PublicDeliveryNoticeProps) {
  const versionLabel = locale === "zh" ? "资料版本" : "Information version";

  // Live data needs no warning: the version stays as a quiet footnote.
  if (delivery.state === "live" && coverage.state !== "partial" && localeDelivery.translation === "reviewed") {
    return (
      <p className="pa-delivery-note" data-testid="public-delivery-notice">
        {versionLabel} {release.id}
      </p>
    );
  }

  const unavailable = delivery.state === "unavailable";
  const title = locale === "zh"
    ? unavailable
      ? "熊猫资料暂时无法更新"
      : delivery.state === "cached"
        ? "正在显示最近可用的熊猫资料"
        : "部分熊猫资料暂缺"
    : unavailable
      ? "Panda information cannot be refreshed right now"
      : delivery.state === "cached"
        ? "Showing the latest available panda information"
        : "Some panda information is missing";
  const details = [
    coverage.state === "partial" ? (locale === "zh" ? "本页只有部分资料" : "Only part of this page is available") : null,
    localeDelivery.translation === "reviewed" ? null : (locale === "zh" ? "部分内容还没有中文翻译" : "Some content is not yet translated into English"),
    delivery.lastSuccessfulAt ? `${locale === "zh" ? "最近更新" : "Last updated"} ${delivery.lastSuccessfulAt}` : null,
  ].filter((detail): detail is string => Boolean(detail));

  return (
    <aside
      className="pa-delivery-notice"
      data-testid="public-delivery-notice"
      aria-label={locale === "zh" ? "熊猫资料状态" : "Panda information status"}
    >
      <span className="pa-delivery-icon" aria-hidden="true">
        {unavailable ? <TriangleAlert /> : <Database />}
      </span>
      <div>
        <strong>{title}</strong>
        {details.map((detail) => <p key={detail}>{detail}</p>)}
        <p>{versionLabel} {release.id}</p>
      </div>
    </aside>
  );
}
