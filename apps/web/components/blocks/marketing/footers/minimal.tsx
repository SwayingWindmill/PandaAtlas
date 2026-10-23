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
      title: zh ? "我的" : "Personal",
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
        { title: zh ? "每日一猫" : "Daily Panda", href: `/${locale}/games/daily` },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t-[0.5px] border-[var(--pa-color-line)] bg-[var(--pa-color-surface)] text-[var(--pa-color-ink)]">
      <div className="mx-auto w-[min(var(--pa-content-max),calc(100%-2*var(--pa-space-page)))] pb-10 pt-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(24rem,auto)] md:gap-14">
          <div>
            <Link
              href={`/${locale}` as Route}
              className="inline-flex"
              aria-label={zh ? "吱熊猫首页" : "ZhiPanda home"}
            >
              <ZhiPandaLogo locale={locale} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
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
