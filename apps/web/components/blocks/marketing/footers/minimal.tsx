import type { Route } from "next";
import Link from "next/link";

import { ZhiPandaLogo } from "@/components/brand/zhipanda-logo";

export default function FooterMinimal({ locale }: { locale: "zh" | "en" }) {
  const zh = locale === "zh";
  const groups = [
    {
      title: zh ? "探索" : "Explore",
      links: [
        { title: zh ? "熊猫" : "Pandas", href: `/${locale}/prototype/fan-v08/pandas` },
        { title: zh ? "家族" : "Families", href: `/${locale}/families` },
        { title: zh ? "地点" : "Places", href: `/${locale}/map` },
        { title: zh ? "故事" : "Stories", href: `/${locale}/moments` },
      ],
    },
    {
      title: zh ? "我的" : "My",
      links: [
        { title: zh ? "我的熊猫" : "My Pandas", href: `/${locale}/my-pandas` },
        { title: zh ? "我的动态" : "My Feed", href: `/${locale}/me/feed` },
        { title: zh ? "熊猫护照" : "Panda Passport", href: `/${locale}/me/passport` },
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
    <footer className="border-t border-[#fffff2]/16 bg-transparent text-[#fffff2]">
      <div className="mx-auto w-full max-w-[75rem] px-4 pb-7 pt-10 sm:px-6 md:pt-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(24rem,.8fr)] md:gap-14">
          <div className="max-w-[31rem]">
            <Link
              href={`/${locale}/prototype/fan-v08` as Route}
              className="inline-flex text-[#fffff2]"
              aria-label={zh ? "吱熊猫首页" : "ZhiPanda home"}
            >
              <ZhiPandaLogo locale={locale} inverse />
            </Link>
            <p className="mt-5 max-w-[29rem] text-sm leading-7 text-[#fffff2]/68">
              {zh
                ? "从名字、家人、生活过的地方和真实影像，认识每一只熊猫。"
                : "Meet every panda through names, families, places, and real imagery."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-[760] uppercase tracking-[0.08em] text-[#fffff2]/48">
                  {group.title}
                </h3>
                <ul className="mt-3 grid">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href as Route}
                        className="inline-flex min-h-10 items-center text-sm font-[620] text-[#fffff2]/82 transition-colors hover:text-[#f0f63a]"
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

        <div className="mt-10 border-t border-[#fffff2]/14 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-xs text-[#fffff2]/52">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span>© {new Date().getFullYear()} ZhiPanda</span>
              <Link href="/zh/prototype/fan-v08" className={locale === "zh" ? "text-[#fffff2]" : "hover:text-[#fffff2]"}>
                中文
              </Link>
              <Link href="/en/prototype/fan-v08" className={locale === "en" ? "text-[#fffff2]" : "hover:text-[#fffff2]"}>
                English
              </Link>
            </div>
            <span>{zh ? "为熊猫爱好者持续更新" : "Made for panda fans"}</span>
          </div>

          <div
            className="mt-7 overflow-hidden select-none text-[clamp(4.4rem,11vw,9rem)] font-[820] leading-[0.72] tracking-[-0.075em] text-[#fffff2]/[0.045]"
            aria-hidden="true"
          >
            ZHIPANDA
          </div>
        </div>
      </div>
    </footer>
  );
}
