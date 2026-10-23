import { cn } from "@/lib/utils";

export function ZhiPandaMark({
  className,
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  const mark = inverse ? "var(--pa-color-surface)" : "var(--pa-color-ink)";

  return (
    <span
      aria-hidden="true"
      className={cn("block shrink-0", className)}
      style={{
        backgroundColor: mark,
        WebkitMaskImage: "url('/brand/zhipanda-mark-approved.svg')",
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskImage: "url('/brand/zhipanda-mark-approved.svg')",
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
      }}
    />
  );
}

export function ZhiPandaLogo({
  locale,
  className,
  inverse = false,
  compact = false,
}: {
  locale: "zh" | "en";
  className?: string;
  inverse?: boolean;
  compact?: boolean;
}) {
  const ink = inverse ? "text-[var(--pa-color-surface)]" : "text-[var(--pa-color-ink)]";
  const muted = inverse ? "text-[color:rgba(255,255,255,.68)]" : "text-[var(--pa-color-ink-muted)]";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ZhiPandaMark className="h-7 w-[3.15rem] sm:h-8 sm:w-[3.6rem]" inverse={inverse} />
      {compact ? null : (
        <span className="flex items-baseline gap-2">
          <strong
            className={cn("text-[1.25rem] font-black tracking-[-0.02em]", ink)}
            style={{ fontFamily: "var(--zp-font-display-cjk)" }}
          >
            吱熊猫
          </strong>
          <span
            className={cn("hidden text-[9px] font-[720] tracking-[0.14em] sm:inline", muted)}
            style={{ fontFamily: "var(--zp-font-ui-latin)" }}
          >
            ZHIPANDA
          </span>
        </span>
      )}
      <span className="sr-only">
        {locale === "zh" ? "吱熊猫 ZhiPanda" : "ZhiPanda"}
      </span>
    </span>
  );
}
