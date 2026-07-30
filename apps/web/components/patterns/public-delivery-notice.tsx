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
  const cached = delivery.state === "cached";
  const unavailable = delivery.state === "unavailable";
  const title = locale === "zh"
    ? unavailable
      ? "熊猫资料暂时无法更新"
      : cached
        ? "正在显示最近可用的熊猫资料"
        : "熊猫资料来自当前公开版本"
    : unavailable
      ? "Panda information cannot be refreshed right now"
      : cached
        ? "Showing the latest available panda information"
        : "Panda information comes from the current public version";
  const coverageLabel = locale === "zh"
    ? coverage.state === "complete"
      ? "本页资料完整"
      : coverage.state === "partial"
        ? "本页部分资料可用"
        : "选择内容后查看资料范围"
    : coverage.state === "complete"
      ? "Complete for this page"
      : coverage.state === "partial"
        ? "Some information is available"
        : "Choose an item to see available information";
  const translationLabel = locale === "zh"
    ? localeDelivery.translation === "reviewed"
      ? "当前语言内容已核实"
      : "部分内容暂缺当前语言翻译"
    : localeDelivery.translation === "reviewed"
      ? "Content in this language has been reviewed"
      : "Some content is not yet translated into this language";

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
        <p>
          {locale === "zh" ? "资料版本" : "Information version"}: {release.id} · {coverageLabel}
        </p>
        <p>{translationLabel}</p>
        {delivery.lastSuccessfulAt ? (
          <p>{locale === "zh" ? "最近核实" : "Last checked"}: {delivery.lastSuccessfulAt}</p>
        ) : null}
      </div>
    </aside>
  );
}
