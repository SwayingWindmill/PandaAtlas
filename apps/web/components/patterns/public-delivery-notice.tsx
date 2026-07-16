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
  const title = locale === "zh"
    ? cached ? "正在使用缓存的可信发布版本" : "正在使用当前可信发布版本"
    : cached ? "Using a cached trusted public release" : "Using the current trusted public release";
  const coverageLabel = locale === "zh"
    ? coverage.state === "complete" ? "当前任务范围完整" : coverage.state === "partial" ? "当前任务范围部分可用" : "等待查询"
    : coverage.state === "complete" ? "Complete for this task" : coverage.state === "partial" ? "Partially available" : "Awaiting a query";
  const translationLabel = locale === "zh"
    ? localeDelivery.translation === "reviewed" ? "当前语言已审核" : "当前语言翻译缺失"
    : localeDelivery.translation === "reviewed" ? "Current language reviewed" : "Current language translation missing";

  return (
    <aside className="pa-delivery-notice" data-testid="public-delivery-notice" aria-label={locale === "zh" ? "公开数据交付状态" : "Public data delivery status"}>
      <span className="pa-delivery-icon" aria-hidden="true">
        {delivery.state === "unavailable" ? <TriangleAlert /> : <Database />}
      </span>
      <div>
        <strong>{title}</strong>
        <p>
          {locale === "zh" ? "发布版本" : "Release"}: {release.id} · {locale === "zh" ? "公共结构" : "Public schema"}: {release.schemaVersion} · {coverageLabel}
        </p>
        <p>{translationLabel}</p>
        {delivery.lastSuccessfulAt ? (
          <p>{locale === "zh" ? "最后成功核实" : "Last successfully verified"}: {delivery.lastSuccessfulAt}</p>
        ) : null}
      </div>
    </aside>
  );
}
