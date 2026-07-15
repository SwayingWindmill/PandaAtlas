import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight, LocateFixed, RotateCcw, X } from "lucide-react";
import type { AtlasItem } from "@/lib/panda-atlas";
import { Button } from "@/components/ui/button";
import {
  detailFacts,
  detailTypeLabel,
  formatDateLabel,
  itemBadgeClass,
  itemLocationLabel,
  itemStatusLabel
} from "./helpers";

interface EntityDetailDrawerProps {
  item: AtlasItem | null;
  open: boolean;
  snapshotDate: string;
  onClose: () => void;
  onLocate: () => void;
  onResetView: () => void;
}

function modeLabel(mode: AtlasItem["mode"]): string {
  switch (mode) {
    case "china_wild":
      return "中国野生";
    case "china_captive":
      return "中国圈养";
    case "overseas_captive":
      return "海外圈养";
    default:
      return "全球总览";
  }
}

export function EntityDetailDrawer({
  item,
  open,
  snapshotDate,
  onClose,
  onLocate,
  onResetView
}: EntityDetailDrawerProps) {
  if (!item) {
    return null;
  }

  const facts = detailFacts(item, snapshotDate);
  const detailDate = item.kind === "wild_region" ? snapshotDate : item.updatedAt;

  return (
    <div className={`absolute inset-0 z-40 ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label="关闭对象详情"
        onClick={onClose}
        className={`absolute inset-0 transition-colors ${open ? "bg-[rgba(24,34,25,0.12)]" : "bg-transparent"}`}
      />

      <aside
        className={`absolute bottom-0 left-0 right-0 z-10 flex h-[76%] max-h-[42rem] flex-col rounded-t-[32px] border-t border-[rgba(63,125,72,0.12)] bg-[rgba(255,255,255,0.98)] shadow-[0_-22px_40px_rgba(24,34,25,0.16)] transition-transform duration-300 lg:inset-y-0 lg:left-auto lg:h-full lg:max-h-none lg:w-[360px] lg:rounded-l-[24px] lg:rounded-r-none lg:border-l lg:border-t-0 lg:shadow-[-22px_0_42px_rgba(24,34,25,0.12)] ${
          open ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(63,125,72,0.08)] px-5 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-3 text-[12px] leading-5">
              <span className="text-[#526354]">{detailTypeLabel(item)}</span>
              <span className={`rounded-full border px-3 py-1 ${itemBadgeClass(item)}`}>{item.badge}</span>
            </div>
            <h2
              className="mt-3 text-[28px] leading-[1.15] text-[#233126]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {item.name}
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[#526354]">
              右侧抽屉只保留对象阅读，不再承载时间轴或最近变化。
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            aria-label="关闭对象详情"
            onClick={onClose}
            className="h-10 w-10 rounded-none border-0 bg-transparent p-0 text-[#233126] shadow-none hover:bg-transparent hover:text-[#2F6B3B]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            <section className="border-t border-[rgba(63,125,72,0.08)] pt-5">
              <div className="divide-y divide-[rgba(63,125,72,0.08)]">
                {[
                  { label: "所属模式", value: modeLabel(item.mode) },
                  { label: "区域 / 国家 / 城市", value: itemLocationLabel(item) },
                  { label: "当前状态", value: itemStatusLabel(item) },
                  { label: "更新时间", value: formatDateLabel(detailDate) }
                ].map((meta) => (
                  <div key={meta.label} className="flex items-start justify-between gap-4 py-3">
                    <p className="text-[12px] leading-5 text-[#526354]">{meta.label}</p>
                    <p className="max-w-[13rem] text-right text-[15px] leading-7 text-[#233126]">{meta.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-[rgba(63,125,72,0.08)] pt-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#526354]">简介</p>
              <p className="mt-3 text-[15px] leading-7 text-[#5F6E61]">{item.description}</p>
            </section>

            <section className="border-t border-[rgba(63,125,72,0.08)] pt-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#526354]">动态属性</p>
              <div className="mt-3 divide-y divide-[rgba(63,125,72,0.08)]">
                {facts.map((fact) => (
                  <div key={fact.label} className="py-3">
                    <p className="text-[12px] leading-5 text-[#526354]">{fact.label}</p>
                    <p className="mt-1 text-[15px] leading-7 text-[#233126]">{fact.value}</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#7B897C]">{fact.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-[rgba(63,125,72,0.08)] pt-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#526354]">相关标签</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] leading-5 text-[#2F6B3B]">
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="border-t border-[rgba(63,125,72,0.08)] px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:pb-4">
          <div className="space-y-3">
            <Button
              asChild
              variant="outline"
              className="h-10 w-full justify-between rounded-none border-x-0 border-t-0 border-b border-[rgba(47,107,59,0.18)] bg-transparent px-0 text-[13px] text-[#233126] shadow-none hover:bg-transparent hover:text-[#2F6B3B]"
            >
              <Link href={item.detailHref as Route}>
                查看详情页
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-10 w-full justify-between rounded-none border-x-0 border-t-0 border-b border-[rgba(63,125,72,0.12)] bg-transparent px-0 text-[13px] text-[#233126] shadow-none hover:bg-transparent hover:text-[#2F6B3B]"
            >
              <Link href={"/atlas" as Route}>查看相关熊猫</Link>
            </Button>

            <div className="grid gap-1 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={onLocate}
                className="h-10 justify-start rounded-none border-0 bg-transparent px-0 text-[13px] text-[#233126] shadow-none hover:bg-transparent hover:text-[#2F6B3B]"
              >
                <LocateFixed className="mr-2 h-4 w-4" />
                在地图中定位
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onResetView}
                className="h-10 justify-start rounded-none border-0 bg-transparent px-0 text-[13px] text-[#233126] shadow-none hover:bg-transparent hover:text-[#2F6B3B]"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                返回全局
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
