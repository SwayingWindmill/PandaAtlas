import type { Route } from "next";
import Link from "next/link";
import { Leaf, ShieldCheck } from "lucide-react";

export const siteShellClassName = "mx-auto w-[min(1440px,calc(100%-clamp(32px,4vw,120px)))]";

const primaryNavItems = [
  { label: "首页", href: "/" },
  { label: "全球分布", href: "/map" },
  { label: "熊猫档案", href: "/atlas" },
  { label: "栖息地专题", href: "/#knowledge" },
  { label: "保护行动", href: "/#action" },
] as const;

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  const className = `relative text-sm transition-colors ${
    active ? "font-semibold text-[var(--accent)]" : "text-[var(--fg)] hover:text-[var(--accent)]"
  }`;

  if (href.startsWith("/#")) {
    return (
      <a href={href} className={className}>
        {label}
        {active ? <span className="absolute inset-x-0 -bottom-[22px] h-[2px] rounded-full bg-[var(--accent)]" /> : null}
      </a>
    );
  }

  return (
    <Link href={href as Route} className={className}>
      {label}
      {active ? <span className="absolute inset-x-0 -bottom-[22px] h-[2px] rounded-full bg-[var(--accent)]" /> : null}
    </Link>
  );
}

export function SiteHeader({
  activeHref,
  statusLabel,
  statusValue,
}: {
  activeHref?: string;
  statusLabel?: string;
  statusValue?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(63,125,72,0.08)] bg-[var(--bg)]">
      <div className={`${siteShellClassName} flex h-[78px] items-center justify-between gap-4 py-2`}>
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-[0_14px_30px_rgba(47,92,69,0.2)]">
              <Leaf className="h-5 w-5" />
            </span>
            <div>
              <p className="text-lg text-[var(--accent)]" style={{ fontFamily: "var(--font-display)" }}>
                大熊猫图鉴
              </p>
              <p className="text-[11px] tracking-[0.22em] text-[var(--muted)]">分布地图与保护档案</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {primaryNavItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} active={item.href === activeHref} />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {statusLabel || statusValue ? (
            <span className="hidden rounded-full border border-[rgba(47,92,69,0.1)] bg-[var(--card)] px-4 py-2 text-xs text-[var(--muted)] lg:inline-flex">
              {statusLabel}
              {statusLabel && statusValue ? <span className="px-1.5">·</span> : null}
              {statusValue}
            </span>
          ) : null}
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(47,107,59,0.18)] bg-[rgba(47,107,59,0.08)] text-[var(--accent)]">
            <ShieldCheck className="h-4 w-4" />
          </span>
        </div>
      </div>
    </header>
  );
}
