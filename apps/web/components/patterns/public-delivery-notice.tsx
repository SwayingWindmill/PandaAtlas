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
  delivery,
  localeDelivery,
}: PublicDeliveryNoticeProps) {
  // Fans only need to hear about data when something is actually wrong: stale or missing
  // data, or text that is not translated yet. Versions and coverage stay out of public pages.
  if (delivery.state === "live" && localeDelivery.translation === "reviewed") return null;

  const unavailable = delivery.state === "unavailable";
  const title = locale === "zh"
    ? unavailable
      ? "熊猫资料暂时无法更新"
      : delivery.state === "cached"
        ? "正在显示最近可用的熊猫资料"
        : delivery.state === "partial"
          ? "部分熊猫资料暂缺"
          : "部分内容还没有翻译"
    : unavailable
      ? "Panda information cannot be refreshed right now"
      : delivery.state === "cached"
        ? "Showing the latest available panda information"
        : delivery.state === "partial"
          ? "Some panda information is missing"
          : "Some content is not translated yet";
  const details = [
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
      </div>
    </aside>
  );
}
