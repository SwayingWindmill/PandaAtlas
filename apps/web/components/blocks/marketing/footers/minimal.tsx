import type { Route } from "next";
import Link from "next/link";

import { ZhiPandaLogo } from "@/components/brand/zhipanda-logo";

export default function FooterMinimal({ locale }: { locale: "zh" | "en" }) {
  const zh = locale === "zh";
  const groups = [
    {
      title: zh ? "探索" : "Explore",
      links: [
        { title: zh ? "熊猫" : "Pandas", href: `/${locale}/pandas` },
        { title: zh ? "家族" : "Families", href: `/${locale}/families` },
        { title: zh ? "地点" : "Places", href: `/${locale}/map` },
        { title: zh ? "故事" : "Stories", href: `/${locale}/moments` },
      ],
    },
    {
      title: zh ? "我的" : "My",
      links: [
        { title: zh ? "我的熊猫" : "My Pandas", href: `/${locale}/me` },
        { title: zh ? "我的动态" : "My Feed", href: `/${locale}/me/feed` },
      ],
    },
    {
      title: zh ? "参与" : "Participate",
      links: [
        { title: zh ? "纠错与贡献" : "Contribute", href: `/${locale}/contribute` },
        { title: zh ? "随机认识一只" : "Meet one at random", href: `/${locale}/games/random` },
        { title: zh ? "猜熊猫" : "Guess the panda", href: `/${locale}/games/guess` },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-[var(--pa-color-line)] bg-[var(--pa-color-surface)] text-[var(--pa-color-ink)]">
      <div className="mx-auto w-[min(var(--pa-content-max),calc(100%-2*var(--pa-space-page)))] pb-10 pt-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(24rem,.8fr)] md:gap-14">
          <div className="max-w-[31rem]">
            <Link
              href={`/${locale}` as Route}
              className="inline-flex"
              aria-label={zh ? "吱熊猫首页" : "ZhiPanda home"}
            >
              <ZhiPandaLogo locale={locale} />
            </Link>
            <p className="mt-5 max-w-[29rem] text-sm leading-7 text-[var(--pa-color-ink-muted)]">
              {zh
                ? "从名字、家人、生活过的地方和真实影像，认识每一只熊猫。照片均来自授权来源，署名和许可见每只熊猫的资料页。"
                : "Meet every panda through names, families, places, and real imagery. Photos come from licensed sources; credits are on each panda's profile."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-[var(--pa-color-ink-muted)]">{group.title}</h3>
                <ul className="mt-3 grid">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href as Route}
                        className="inline-flex min-h-10 items-center text-sm font-medium transition-colors hover:text-[var(--pa-color-ink-muted)]"
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

        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[var(--pa-color-line)] pt-5 text-xs text-[var(--pa-color-ink-muted)]">
          <span>© {new Date().getFullYear()} ZhiPanda</span>
          <span>{zh ? "为熊猫爱好者持续更新" : "Made for panda fans"}</span>
        </div>
      </div>
    </footer>
  );
}
