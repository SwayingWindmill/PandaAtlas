import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Globe2,
  Leaf,
  MapPinned,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { SiteHeader, siteShellClassName } from "@/components/site/site-header";

const shellClassName = siteShellClassName;

const archiveCards = [
  {
    name: "美兰",
    meta: "雌性 · 12 岁 · 成都大熊猫繁育研究基地",
    image: "/home/archive-mei-lan.jpg"
  },
  {
    name: "宝宝",
    meta: "雌性 · 8 岁 · 卧龙神树坪基地",
    image: "/home/archive-bao-bao.jpg"
  },
  {
    name: "天天",
    meta: "雄性 · 21 岁 · 海外合作保护中心",
    image: "/home/archive-tian-tian.jpg"
  },
  {
    name: "小奇迹",
    meta: "雄性 · 3 岁 · 青年档案样本",
    image: "/home/archive-xiao-qi-ji.jpg"
  }
];

const habitatCards = [
  {
    title: "岷山地区",
    body: "野生种群密度较高，栖息地连续性强，适合作为首页的核心分布样本。"
  },
  {
    title: "秦岭地区",
    body: "区域生态差异明显，适合展示熊猫在不同山系中的生境特征。"
  },
  {
    title: "邛崃山系",
    body: "兼具保护区网络与生态廊道价值，能自然承接保护行动相关内容。"
  }
];

const footerGroups: Array<{ title: string; items: Array<{ label: string; href: string }> }> = [
  {
    title: "档案库",
    items: [
      { label: "熊猫档案", href: "/atlas" },
      { label: "知识百科", href: "#knowledge" },
      { label: "谱系关系", href: "/lineage" }
    ]
  },
  {
    title: "资源中心",
    items: [
      { label: "分布地图", href: "/map" },
      { label: "影像故事", href: "#story" },
      { label: "保护行动", href: "#action" }
    ]
  },
  {
    title: "支持与帮助",
    items: [
      { label: "首页导览", href: "#top" },
      { label: "项目结构", href: "#archives" },
      { label: "联系方式", href: "#footer" }
    ]
  }
];

function SectionLead({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.24em] text-[var(--accent)]">{eyebrow}</p>
        <h2 className="text-[2rem] leading-tight text-[var(--fg)] sm:text-[2.3rem]" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-[0.98rem]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith("/")) {
    return (
      <Link href={href as Route} className="transition-colors hover:text-[var(--accent)]">
        {label}
      </Link>
    );
  }

  return (
    <a href={href} className="transition-colors hover:text-[var(--accent)]">
      {label}
    </a>
  );
}

export default function HomePage() {
  return (
    <main id="top" className="pb-0 pt-0">
      <SiteHeader activeHref="/" statusLabel="站点导览" statusValue="大熊猫图鉴" />

      <section className={`${shellClassName} home-hero py-6 lg:py-0`}>
        <div className="home-hero-grid grid items-center gap-8 xl:gap-12 lg:grid-cols-[0.98fr_1.02fr]">
          <div className="home-fade-up home-hero-copy space-y-7">
            <div className="space-y-4">
              <span className="inline-flex rounded-full bg-[rgba(63,125,71,0.1)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                全球物种数据库
              </span>
              <h1
                className="home-hero-title max-w-[44rem] text-[2.85rem] leading-[1.02] text-[var(--fg)] sm:text-[4rem] lg:text-[4.6rem]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                权威、专业的大熊猫
                <span className="text-[var(--accent)]"> 学术档案库</span>
              </h1>
              <p className="home-hero-body max-w-[37rem] text-[1rem] leading-8 text-[var(--muted)]">
                一个以个体记录、知识整理、生态分布和保护行动为核心的大熊猫内容首页。
                它既有自然题材的安静气质，也保持学术型内容网站应有的清晰度和可信度。
              </p>
            </div>

            <div className="home-hero-actions flex flex-wrap gap-4">
              <Link
                href="/atlas"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-7 py-4 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(47,92,69,0.22)] transition-transform hover:-translate-y-0.5"
              >
                开启档案探索
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#knowledge"
                className="inline-flex items-center rounded-full bg-[rgba(47,92,69,0.08)] px-7 py-4 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[rgba(47,92,69,0.14)]"
              >
                查看普查内容
              </a>
            </div>
          </div>

          <div className="home-fade-up home-hero-media relative min-w-0 w-full">
            <div className="absolute -inset-3 rounded-[2rem] bg-[rgba(63,125,71,0.06)] blur-xl" />
            <div className="relative overflow-hidden rounded-[1.9rem] border border-[rgba(63,125,72,0.12)] bg-white shadow-[0_24px_54px_rgba(31,48,32,0.12)]">
              <div className="home-hero-media-frame relative aspect-[6/5] overflow-hidden lg:aspect-auto">
                <Image
                  src="/home/hero-panda.jpg"
                  alt="首页熊猫主视觉"
                  width={1200}
                  height={1000}
                  priority
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="archives" className="border-y border-[rgba(63,125,72,0.08)] bg-[rgba(255,255,255,0.76)] py-14 lg:py-16">
        <div className={shellClassName}>
          <SectionLead
            eyebrow="个体档案"
            title="个体档案集"
            description="记录全球保护中心及自然保护区内大熊猫的成长轨迹与生命历程。首页先给出四张高识别度卡片，再引导进入完整图鉴。"
            action={
              <Link href="/atlas" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                查看全部档案
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {archiveCards.map((item, index) => (
              <article
                key={item.name}
                className="home-fade-up overflow-hidden rounded-[1.5rem] border border-[rgba(47,92,69,0.08)] bg-[var(--card)] shadow-[0_18px_40px_rgba(36,49,36,0.08)]"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image src={item.image} alt={`${item.name} 档案照片`} fill sizes="(max-width: 1280px) 50vw, 24vw" className="object-cover transition-transform duration-700 hover:scale-105" />
                </div>
                <div className="space-y-2 p-4">
                  <h3 className="text-[1.35rem] text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>
                    {item.name}
                  </h3>
                  <p className="text-sm leading-6 text-[var(--muted)]">{item.meta}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="knowledge" className={`${shellClassName} py-14 lg:py-16`}>
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.24em] text-[var(--accent)]">知识中心</p>
          <h2 className="mt-3 text-[2rem] leading-tight text-[var(--fg)] sm:text-[2.5rem]" style={{ fontFamily: "var(--font-display)" }}>
            知识中心：大熊猫百科
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-[0.98rem]">
            通过精心整理的专题内容，帮助用户从“看熊猫”进入“理解熊猫”的阶段。这里的布局直接参考 Stitch 设计稿的内容区节奏。
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-5">
            {[
              {
                category: "生物学研究",
                title: "竹子悖论：营养摄入背后的生物学逻辑",
                body: "深入解释熊猫为什么能以竹子为主食，并依靠极高的采食效率和行为节律维持能量平衡。",
                image: "/home/knowledge-bamboo.jpg",
                icon: BookOpen
              },
              {
                category: "文化与历史",
                title: "熊猫如何从自然物种成为全球文化符号",
                body: "从物种保护到公众传播，梳理大熊猫在国际合作中的象征意义，以及它如何持续影响保护叙事。",
                image: "/home/knowledge-scroll.jpg",
                icon: Globe2
              }
            ].map((item, index) => (
              <article
                key={item.title}
                className="home-fade-up flex flex-col gap-5 rounded-[1.6rem] border border-[rgba(47,92,69,0.08)] bg-white p-5 shadow-[0_18px_40px_rgba(36,49,36,0.07)] sm:flex-row"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="relative h-52 w-full overflow-hidden rounded-[1.2rem] sm:h-auto sm:w-52 sm:flex-none">
                  <Image src={item.image} alt={item.title} fill sizes="(max-width: 640px) 100vw, 220px" className="object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                      <item.icon className="h-4 w-4" />
                      {item.category}
                    </p>
                    <h3 className="text-[1.35rem] leading-8 text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>
                      {item.title}
                    </h3>
                    <p className="text-sm leading-7 text-[var(--muted)]">{item.body}</p>
                  </div>
                  <a href="#knowledge" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                    阅读专题
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>

          <aside className="home-fade-up rounded-[1.7rem] border border-[rgba(47,92,69,0.08)] bg-[rgba(63,125,71,0.08)] p-7 shadow-[0_18px_40px_rgba(36,49,36,0.06)]">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
              <Camera className="h-4 w-4 text-[var(--accent)]" />
              统计数据概览
            </p>
            <div className="mt-6 space-y-6">
              <div className="border-b border-[rgba(47,92,69,0.08)] pb-4">
                <div className="text-4xl font-semibold text-[var(--accent)]">1,864+</div>
                <p className="mt-1 text-sm text-[var(--fg)]">野生种群估算总数</p>
                <div className="mt-3 h-1.5 rounded-full bg-[rgba(47,92,69,0.12)]">
                  <div className="h-full w-[75%] rounded-full bg-[var(--accent)]" />
                </div>
              </div>
              <div className="border-b border-[rgba(47,92,69,0.08)] pb-4">
                <div className="text-4xl font-semibold text-[var(--accent)]">67</div>
                <p className="mt-1 text-sm text-[var(--fg)]">已建立自然保护区数量</p>
              </div>
              <div>
                <div className="text-4xl font-semibold text-[var(--accent)]">600+</div>
                <p className="mt-1 text-sm text-[var(--fg)]">圈养档案登记总量</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="story" className="overflow-hidden bg-[linear-gradient(135deg,#3f7d48,#1e3824)] py-14 lg:py-16 text-white">
        <div className={`${shellClassName} grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]`}>
          <div className="home-fade-up space-y-5">
            <span className="inline-flex rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/88">
              精选视听档案
            </span>
            <h2 className="text-[2.25rem] leading-tight sm:text-[2.7rem]" style={{ fontFamily: "var(--font-display)" }}>
              岁月的瞬间：
              <br />
              高山生境中的生命律动
            </h2>
            <p className="max-w-xl text-sm leading-8 text-white/78 sm:text-[0.98rem]">
              这一段保留了 Stitch 稿里的深色节奏切换。首页在这里从浅色内容页切到沉浸式影像段落，让用户停下来“看”，而不是继续被文字推进。
            </p>
            <div className="flex items-center gap-8 pt-3">
              <div>
                <div className="text-3xl font-semibold">4.2M</div>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/60">全球播放次数</p>
              </div>
              <div className="h-10 w-px bg-white/18" />
              <div>
                <div className="text-3xl font-semibold">120k</div>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/60">科普分享</p>
              </div>
            </div>
          </div>

          <div className="home-fade-up relative overflow-hidden rounded-[1.7rem] shadow-[0_28px_70px_rgba(0,0,0,0.3)]">
            <div className="relative aspect-video">
              <Image src="/home/story-video.jpg" alt="大熊猫影像故事封面" fill sizes="(max-width: 1024px) 100vw, 54vw" className="object-cover opacity-76" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.35))]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/92 text-[var(--accent)]">
                  <PlayCircle className="h-10 w-10" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="habitat" className={`${shellClassName} py-14 lg:py-16`}>
        <SectionLead
          eyebrow="栖息区域"
          title="生态区域：栖息地分布"
          description="继续沿用 Stitch 稿里“左图右信息”的结构。第一版先以静态示意图和三张说明卡构成首页生态段落，不在这里堆复杂交互。"
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="home-fade-up overflow-hidden rounded-[1.7rem] border border-[rgba(47,92,69,0.08)] bg-white shadow-[0_18px_40px_rgba(36,49,36,0.07)]">
            <div className="relative aspect-[16/10]">
              <Image src="/home/habitat-map.svg" alt="大熊猫主要山系分布示意图" fill sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover" />
            </div>
          </article>

          <div className="grid gap-4">
            {habitatCards.map((item, index) => (
              <article
                key={item.title}
                className="home-fade-up rounded-[1.4rem] border border-[rgba(47,92,69,0.08)] bg-white p-5 shadow-[0_18px_40px_rgba(36,49,36,0.06)]"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <p className="text-[1.2rem] text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="action" className={`${shellClassName} pb-4 pt-2`}>
        <div className="home-fade-up overflow-hidden rounded-[1.8rem] border border-[rgba(47,92,69,0.08)] bg-[rgba(63,125,71,0.06)] px-7 py-9 shadow-[0_20px_44px_rgba(36,49,36,0.06)] sm:px-10 sm:py-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">全球行动追踪</p>
              <h2 className="text-[2rem] leading-tight text-[var(--fg)] sm:text-[2.5rem]" style={{ fontFamily: "var(--font-display)" }}>
                把首页的情绪价值，最终落回保护本身。
              </h2>
              <p className="text-sm leading-8 text-[var(--muted)] sm:text-[0.98rem]">
                保护内容在首页不需要喧闹。用一个安静、明确、可信的行动区块收束前面的视觉和内容，让整页从“看到熊猫”自然过渡到“理解保护”。
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:min-w-[280px]">
              <a
                href="#action"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(47,92,69,0.18)]"
              >
                <ShieldCheck className="h-4 w-4" />
                加入保护行动
              </a>
              <Link
                href="/map"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(47,92,69,0.12)] bg-white px-6 py-4 text-sm font-semibold text-[var(--fg)]"
              >
                <MapPinned className="h-4 w-4 text-[var(--accent)]" />
                查看生态分布
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer id="footer" className="mt-6 border-t border-[rgba(63,125,72,0.08)] bg-[rgba(255,255,255,0.82)] pb-4 pt-10">
        <div className={`${shellClassName} grid gap-10 lg:grid-cols-[1.2fr_0.8fr]`}>
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
                <Leaf className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg text-[var(--accent)]" style={{ fontFamily: "var(--font-display)" }}>
                  熊猫档案
                </p>
                <p className="text-sm text-[var(--muted)]">以清晰内容结构组织大熊猫相关知识与档案。</p>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-8 text-[var(--muted)]">
              这一版首页以 Stitch 设计稿为主要参考，保留浅底、自然、安静、专业的首页气质，减少额外扩展内容，把重点放回首页节奏和卡片布局本身。
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title} className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">{group.title}</p>
                <div className="grid gap-2 text-sm text-[var(--muted)]">
                  {group.items.map((item) => (
                    <FooterLink key={item.label} href={item.href} label={item.label} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}

