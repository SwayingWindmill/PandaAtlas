import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { AtlasBrowser } from "@/components/atlas/atlas-browser";
import { SiteHeader, siteShellClassName } from "@/components/site/site-header";
import { ATLAS_HERO_COPY, ATLAS_HERO_STATS, ATLAS_ROUTE_BAND } from "@/lib/atlas-copy";
import { buildAtlasPandaCard } from "@/lib/atlas-presenters";
import { listAtlasPandas } from "@/lib/api-client";

const shellClassName = siteShellClassName;

export default async function AtlasPage() {
  const data = await listAtlasPandas();
  const cards = data.items.map(buildAtlasPandaCard);
  const featuredCount = cards.filter((item) => item.featured).length;
  const locationCount = new Set(cards.map((item) => item.locationShort)).size;
  const heroStats = [`${cards.length} 份`, `${locationCount} 处`, `${featuredCount} 份`];

  return (
    <main className="pb-16 pt-0" data-testid="atlas-page">
      <SiteHeader activeHref="/atlas" statusLabel="熊猫档案" statusValue={`${cards.length} 份收录`} />

      <section className={`${shellClassName} py-10 lg:py-14`}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="home-fade-up">
            <nav className="mb-4 flex items-center gap-2 text-sm text-[rgba(63,125,71,0.65)]">
              <Link href="/" className="transition-colors hover:text-[var(--accent)]">
                {ATLAS_HERO_COPY.breadcrumb}
              </Link>
              <span>/</span>
              <span className="font-medium text-[var(--accent)]">熊猫档案</span>
            </nav>

            <span className="inline-flex rounded-full bg-[rgba(63,125,71,0.08)] px-4 py-2 text-xs font-semibold tracking-[0.26em] text-[var(--accent)]">
              {ATLAS_HERO_COPY.kicker}
            </span>

            <h1
              className="mt-5 max-w-[14ch] text-[2.9rem] leading-[1.02] text-[var(--fg)] sm:text-[3.6rem] lg:text-[4.15rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ATLAS_HERO_COPY.title}
            </h1>

            <p className="mt-5 max-w-[38rem] text-[1rem] leading-8 text-[var(--muted)]">
              {ATLAS_HERO_COPY.body}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {ATLAS_HERO_STATS.map((item, index) => (
                <div
                  key={item.key}
                  className="rounded-[1.1rem] border border-[rgba(47,92,69,0.06)] bg-white/92 px-4 py-3 shadow-[0_10px_24px_rgba(30,44,31,0.04)]"
                >
                  <p className="text-xs font-semibold tracking-[0.18em] text-[rgba(63,125,71,0.72)]">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--fg)]">{heroStats[index]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="home-fade-up">
            <div className="relative overflow-hidden rounded-[1.8rem] border border-[rgba(47,92,69,0.08)] bg-white shadow-[0_18px_46px_rgba(30,44,31,0.12)]">
              <div className="relative aspect-[16/10]">
                <Image
                  src="/atlas/stitch-bamboo-hero.jpg"
                  alt={ATLAS_HERO_COPY.imageAlt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 54vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,6,0.02),rgba(5,8,6,0.32))]" />
                <div className="absolute bottom-4 left-4 z-10 rounded-[1rem] bg-[rgba(255,255,255,0.88)] px-4 py-3 text-[var(--fg)] backdrop-blur">
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-[rgba(63,125,71,0.74)]">档案主题入口</p>
                  <p className="mt-2 text-sm font-semibold sm:text-base">先浏览个体，再进入详情、地图与谱系。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${shellClassName} pb-14`}>
        <AtlasBrowser items={cards} />
      </section>

      <section className="border-t border-[rgba(47,92,69,0.08)] bg-[rgba(255,255,255,0.45)] py-12">
        <div className={`${shellClassName} home-fade-up`}>
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] text-[rgba(63,125,71,0.72)]">继续探索</p>
            <h2 className="mt-3 text-[2rem] text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>
              从档案索引进入更多阅读路径
            </h2>
            <p className="mt-3 max-w-[42rem] text-sm leading-8 text-[var(--muted)]">
              `/atlas` 仍然是主浏览入口。若你想继续按地理分布或亲缘线索延伸阅读，可以从下面两条次级路径继续进入。
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {ATLAS_ROUTE_BAND.map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
                className="rounded-[1.4rem] border border-[rgba(47,92,69,0.08)] bg-white px-6 py-5 shadow-[0_12px_30px_rgba(30,44,31,0.05)] transition hover:-translate-y-0.5 hover:border-[rgba(63,125,71,0.2)]"
              >
                <p className="text-xs font-semibold tracking-[0.22em] text-[rgba(63,125,71,0.72)]">{item.kicker}</p>
                <h3 className="mt-3 text-[1.4rem] text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.body}</p>
                <span className="mt-5 inline-flex text-sm font-semibold text-[var(--accent)]">进入路线</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
