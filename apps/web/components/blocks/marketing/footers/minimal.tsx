import type { Route } from "next";
import Link from "next/link";

import { ZhiPandaLogo } from "@/components/brand/zhipanda-logo";

export default function FooterMinimal({
  locale,
  contributeEnabled = false,
}: {
  locale: "zh" | "en";
  contributeEnabled?: boolean;
}) {
  const zh = locale === "zh";
  const groups = [
    {
      title: zh ? "浏览" : "Browse",
      links: [
        { title: zh ? "熊猫" : "Pandas", href: `/${locale}/pandas` },
        { title: zh ? "地图" : "Map", href: `/${locale}/map` },
        { title: zh ? "家谱" : "Family tree", href: `/${locale}/families` },
        { title: zh ? "日历" : "Calendar", href: `/${locale}/moments` },
        { title: zh ? "游戏" : "Games", href: `/${locale}/games` },
      ],
    },
    {
      title: zh ? "我的" : "Yours",
      links: [
        { title: zh ? "我的熊猫" : "My Pandas", href: `/${locale}/me` },
        { title: zh ? "搜索" : "Search", href: `/${locale}/search` },
        ...(contributeEnabled
          ? [{ title: zh ? "发现错误" : "Report a mistake", href: `/${locale}/contribute` }]
          : []),
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t-[0.5px] border-[var(--pa-color-line)] bg-[var(--pa-color-surface)] text-[var(--pa-color-ink)]">
      <div className="mx-auto w-[min(var(--pa-content-max),calc(100%-2*var(--pa-space-page)))] pb-10 pt-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(16rem,auto)] md:gap-14">
          <div>
            <Link
              href={`/${locale}` as Route}
              className="inline-flex"
              aria-label={zh ? "吱熊猫首页" : "ZhiPanda home"}
            >
              <ZhiPandaLogo locale={locale} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-8">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold text-[var(--pa-color-ink-muted)]">{group.title}</h3>
                <ul className="mt-3 grid">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href as Route}
                        className="inline-flex min-h-10 items-center text-base font-medium hover:underline hover:underline-offset-[3px]"
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 border-t-[0.5px] border-[var(--pa-color-line)] pt-5 text-xs text-[var(--pa-color-ink-muted)]">
          © {new Date().getFullYear()} ZhiPanda
        </p>
      </div>
    </footer>
  );
}
