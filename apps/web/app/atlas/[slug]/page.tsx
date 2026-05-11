import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Camera, Leaf } from "lucide-react";
import { ProfileHeroActions } from "@/components/atlas/profile-hero-actions";
import { SiteHeader } from "@/components/site/site-header";
import {
  getPandaDetail,
  listAtlasPandas,
  resolvePandaReference
} from "@/lib/api-client";
import { buildPandaProfileExperience } from "@/lib/panda-profile";

interface DetailPageProps {
  params: Promise<{ slug: string }>;
}

const shellClassName = "mx-auto w-[min(1440px,calc(100%-clamp(32px,4vw,120px)))]";

const footerGroups = [
  {
    title: "档案库",
    items: [
      { label: "熊猫档案", href: "/atlas" },
      { label: "知识百科", href: "/#knowledge" },
      { label: "谱系关系", href: "/lineage" }
    ]
  },
  {
    title: "资源中心",
    items: [
      { label: "分布地图", href: "/map" },
      { label: "首页专题", href: "/" },
      { label: "保护行动", href: "/#action" }
    ]
  },
  {
    title: "支持与帮助",
    items: [
      { label: "返回首页", href: "/" },
      { label: "浏览图鉴", href: "/atlas" },
      { label: "联系档案组", href: "#footer" }
    ]
  }
];

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="transition-colors hover:text-[var(--accent)]">
      {label}
    </a>
  );
}

export async function generateStaticParams() {
  const data = await listAtlasPandas();
  return data.items.map((item) => ({ slug: item.slug }));
}

export default async function PandaDetailPage({ params }: DetailPageProps) {
  const { slug } = await params;
  const reference = await resolvePandaReference(slug);
  if (!reference) {
    notFound();
  }

  if (slug !== reference.slug) {
    redirect(`/atlas/${reference.slug}`);
  }

  const [panda, atlasPandas] = await Promise.all([
    getPandaDetail(reference.id, reference),
    listAtlasPandas()
  ]);
  if (!panda) {
    notFound();
  }

  const experience = buildPandaProfileExperience({
    panda,
    atlasItems: atlasPandas.items,
    canonicalSlug: reference.slug
  });
  const lineageHref = `/lineage?focus=${reference.slug}`;
  const [featuredReading, ...secondaryReadings] = experience.readings;

  return (
    <main id="top" className="pb-0 pt-0" data-testid="panda-profile-page">
      <SiteHeader activeHref="/atlas" statusLabel="当前档案" statusValue={experience.nameZh} />

      <section className={`${shellClassName} pt-6 lg:pt-8`}>
        <div className="home-fade-up relative overflow-hidden rounded-[2rem] border border-[rgba(63,125,72,0.08)] bg-[var(--card)] shadow-[0_28px_70px_rgba(28,40,31,0.12)]">
          <div className="relative aspect-[5/4] min-h-[420px] w-full md:aspect-[21/9] lg:min-h-[540px]">
            <Image src={experience.heroImage} alt={experience.heroAlt} fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,6,0.06),rgba(10,14,10,0.25)_48%,rgba(7,10,8,0.84)_100%)]" />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 lg:p-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[54rem] space-y-4 lg:space-y-5">
                <div className="flex flex-wrap items-center gap-3 text-white/88">
                  <span className="inline-flex rounded-full border border-white/18 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] backdrop-blur-sm">{experience.eyebrow}</span>
                  <Link href="/atlas" className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/88 backdrop-blur-sm transition-colors hover:bg-white/16">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    返回图鉴
                  </Link>
                </div>

                <div className="space-y-3">
                  <h1 className="text-[2.8rem] leading-[0.96] text-white sm:text-[4rem] lg:text-[5.55rem] xl:text-[5.9rem]" style={{ fontFamily: "var(--font-display)" }}>
                    {experience.nameZh}
                    <span className="ml-3 align-middle text-[1.1rem] font-medium text-white/74 sm:text-[1.6rem] lg:text-[2rem]">({experience.nameEn})</span>
                  </h1>
                  <p className="max-w-2xl text-base font-medium text-white/88 sm:text-[1.08rem]">{experience.heroMeta}</p>
                  <p className="max-w-[44rem] text-sm leading-8 text-white/74 sm:text-[0.98rem]">{experience.summary}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {experience.heroTags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/18 bg-white/12 px-4 py-2 text-sm font-medium text-white/88 backdrop-blur-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <ProfileHeroActions slug={reference.slug} nameZh={experience.nameZh} />
            </div>
          </div>
        </div>
      </section>

      <section className={`${shellClassName} py-7 lg:py-9`}>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-5">
          {experience.heroStats.map((stat, index) => (
            <article key={stat.label} className="home-fade-up flex min-h-[11.25rem] flex-col items-center justify-center rounded-[1.7rem] border border-[rgba(47,92,69,0.08)] bg-white px-6 py-8 shadow-[0_16px_34px_rgba(36,49,36,0.06)]" style={{ animationDelay: `${index * 70}ms` }}>
              <p className="flex items-center justify-center text-[var(--accent)]"><stat.icon className="h-6 w-6" /></p>
              <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{stat.label}</p>
              <p className="mt-2 text-center text-[1.12rem] font-semibold leading-8 text-[var(--fg)]">{stat.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${shellClassName} py-5 lg:py-7`}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.28fr)_minmax(20rem,0.72fr)] lg:items-start">
          <article id="story" className="home-fade-up rounded-[1.9rem] border border-[rgba(47,92,69,0.08)] bg-white p-7 shadow-[0_20px_44px_rgba(36,49,36,0.06)] sm:p-10">
            <div className="flex items-center gap-3 text-[var(--accent)]">
              <BookOpen className="h-5 w-5" />
              <p className="text-xs font-semibold tracking-[0.24em]">个体故事</p>
            </div>
            <h2 className="mt-5 text-[2rem] leading-tight text-[var(--fg)] sm:text-[2.2rem]" style={{ fontFamily: "var(--font-display)" }}>{experience.nameZh} 的故事</h2>
            <blockquote className="mt-7 rounded-[1.5rem] border-l-4 border-[var(--accent)] bg-[rgba(63,125,71,0.05)] px-6 py-6 text-[1.22rem] leading-8 text-[var(--fg)] sm:text-[1.3rem]">{experience.storyQuote}</blockquote>
            <div className="mt-7 grid gap-5 text-sm leading-8 text-[var(--muted)] sm:text-[1rem]">
              {experience.storyParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>

          <aside id="traits" className="home-fade-up rounded-[1.8rem] border border-[rgba(47,92,69,0.08)] bg-[rgba(63,125,71,0.06)] p-7 shadow-[0_18px_40px_rgba(36,49,36,0.05)] sm:p-8">
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-[var(--accent)]">性格与习性</p>
              <h2 className="mt-4 text-[1.9rem] leading-tight text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>性格与生活习性</h2>
              <p className="mt-4 text-sm leading-8 text-[var(--muted)]">这一组内容不再重复基础字段，而是把性格、偏好和日常行为组织成更有温度的阅读块。</p>
            </div>

            <div className="mt-7 space-y-5">
              {experience.traits.map((item, index) => (
                <article key={item.title} className="home-fade-up border-t border-[rgba(47,92,69,0.12)] pt-5 first:border-t-0 first:pt-0" style={{ animationDelay: `${index * 70}ms` }}>
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-[var(--accent)] text-white">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-[1.18rem] text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section id="timeline" className={`${shellClassName} py-14 lg:py-16`}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.24em] text-[var(--accent)]">成长时间线</p>
          <h2 className="mt-4 text-[2rem] leading-tight text-[var(--fg)] sm:text-[2.35rem]" style={{ fontFamily: "var(--font-display)" }}>成长足迹与里程碑</h2>
          <p className="mt-4 text-sm leading-8 text-[var(--muted)] sm:text-[0.98rem]">从出生、驻留到关系入口建立，这些节点把 profile 页面和后续 lineage 浏览真正接了起来。</p>
        </div>

        <div className="relative mt-12">
          <div className="absolute left-[9%] right-[9%] top-[2.1rem] hidden h-px bg-[rgba(63,125,71,0.14)] md:block" />
          <div className="grid gap-6 md:grid-cols-4">
            {experience.timeline.map((item, index) => (
              <article key={`${item.time}-${item.title}`} className="home-fade-up relative min-h-[15rem] rounded-[1.7rem] border border-[rgba(47,92,69,0.08)] bg-white p-7 pt-8 shadow-[0_18px_40px_rgba(36,49,36,0.05)]" style={{ animationDelay: `${index * 70}ms` }}>
                <span className="mb-4 inline-flex rounded-full bg-[var(--accent)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white md:absolute md:-top-4 md:left-1/2 md:-translate-x-1/2">{item.time}</span>
                <h3 className="pt-3 text-[1.22rem] text-[var(--fg)] md:pt-6" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="media" className="overflow-hidden bg-[linear-gradient(135deg,#2d5232,#16241a)] py-14 text-white lg:py-16">
        <div className={`${shellClassName} grid gap-8 lg:grid-cols-[0.4fr_0.6fr]`}>
          <div className="home-fade-up space-y-5">
            <p className="text-xs font-semibold tracking-[0.24em] text-white/70">影像记录</p>
            <h2 className="text-[2rem] leading-tight sm:text-[2.5rem]" style={{ fontFamily: "var(--font-display)" }}>生活影像与视觉记忆</h2>
            <p className="text-sm leading-8 text-white/76 sm:text-[0.98rem]">影像区沿用拼贴式节奏，用更大的图面优先建立记忆点，同时避免再回到纯字段视图。</p>

            <article className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.06] shadow-[0_28px_70px_rgba(0,0,0,0.18)]">
              <div className="relative aspect-video">
                <Image src={experience.featuredMedia.src} alt={experience.featuredMedia.alt} fill sizes="(max-width: 1024px) 100vw, 34vw" className="object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,8,0.08),rgba(7,10,8,0.45))]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white/88 text-[var(--accent)] sm:h-20 sm:w-20">
                    <Camera className="h-9 w-9 sm:h-10 sm:w-10" />
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-white/68">影像片段</p>
                    <p className="mt-2 text-lg font-semibold text-white">{experience.featuredMedia.title}</p>
                  </div>
                  <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-xs font-semibold text-white/82">{experience.featuredMedia.duration}</span>
                </div>
              </div>
            </article>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {experience.gallery.map((item, index) => (
              <article key={item.src} className={`home-fade-up group overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.06] shadow-[0_18px_40px_rgba(0,0,0,0.16)] ${item.large ? "col-span-2 row-span-2" : ""}`} style={{ animationDelay: `${index * 70}ms` }}>
                <div className={`relative ${item.large ? "aspect-[16/10]" : "aspect-square"}`}>
                  <Image src={item.src} alt={item.alt} fill sizes="(max-width: 1024px) 50vw, 28vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,6,0.04),rgba(5,8,6,0.56))]" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/68">{item.caption}</p>
                    <p className="mt-2 text-sm leading-6 text-white/88">{item.detail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="family" className={`${shellClassName} py-14 lg:py-16`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.24em] text-[var(--accent)]">家族关系</p>
            <h2 className="mt-4 text-[2rem] leading-tight text-[var(--fg)] sm:text-[2.3rem]" style={{ fontFamily: "var(--font-display)" }}>家族关系与关联个体</h2>
            <p className="mt-4 text-sm leading-8 text-[var(--muted)]">家族关系区不做复杂关系图，先用轻量卡片建立认知，并保证每张卡都能继续跳到真实档案页。</p>
          </div>
          <a href={lineageHref} className="inline-flex items-center gap-2 rounded-full border border-[rgba(47,92,69,0.12)] bg-white px-5 py-3 text-sm font-semibold text-[var(--accent)] shadow-[0_10px_24px_rgba(36,49,36,0.05)]">
            查看谱系关系
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {experience.family.length > 0 ? (
          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {experience.family.map((item, index) => (
              <a key={`${item.relation}-${item.name}`} href={item.href} className="home-fade-up group flex items-center gap-5 rounded-[1.7rem] border border-[rgba(47,92,69,0.08)] bg-white p-6 shadow-[0_18px_40px_rgba(36,49,36,0.05)] transition-transform hover:-translate-y-0.5 hover:bg-[rgba(63,125,71,0.03)]" style={{ animationDelay: `${index * 70}ms` }}>
                <div className="relative h-[6.15rem] w-[6.15rem] shrink-0 overflow-hidden rounded-full border-2 border-[rgba(63,125,71,0.14)] bg-[rgba(63,125,71,0.08)]">
                  <Image src={item.image} alt={item.name} fill sizes="88px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-[1.2rem] text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>{item.name}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{item.relation}</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.blurb}</p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.5rem] border border-dashed border-[rgba(47,92,69,0.14)] bg-white/70 p-8 text-sm leading-8 text-[var(--muted)]">该个体的家族关系仍在补录中。当前页面会明确保留空状态，而不会再展示无法继续跳转的占位卡片。</div>
        )}
      </section>

      <section id="reading" className={`${shellClassName} py-4 lg:py-6`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.24em] text-[var(--accent)]">延伸阅读</p>
            <h2 className="mt-4 text-[2rem] leading-tight text-[var(--fg)] sm:text-[2.3rem]" style={{ fontFamily: "var(--font-display)" }}>科普与延伸阅读</h2>
            <p className="mt-4 text-sm leading-8 text-[var(--muted)]">把详情页的情绪阅读自然带到更大的生态背景、基地观察和谱系浏览里，而不是简单平铺三张文章卡。</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
            回到首页专题
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {featuredReading ? (
          <div className="mt-9 grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)]">
            <a href={featuredReading.href} className="home-fade-up group overflow-hidden rounded-[1.9rem] border border-[rgba(47,92,69,0.08)] bg-white shadow-[0_20px_46px_rgba(36,49,36,0.06)] transition-transform hover:-translate-y-0.5">
              <div className="grid h-full lg:grid-cols-[0.56fr_0.44fr]">
                <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[22rem]">
                  <Image src={featuredReading.image} alt={featuredReading.title} fill sizes="(max-width: 1024px) 100vw, 42vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div className="flex flex-col justify-center space-y-4 p-6 sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{featuredReading.category}</p>
                  <h3 className="text-[1.45rem] leading-8 text-[var(--fg)] transition-colors group-hover:text-[var(--accent)]" style={{ fontFamily: "var(--font-display)" }}>{featuredReading.title}</h3>
                  <p className="text-sm leading-8 text-[var(--muted)]">{featuredReading.summary}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                    继续阅读
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </a>

            <div className="grid gap-6">
              {secondaryReadings.map((item, index) => (
                <a key={item.title} href={item.href} className="home-fade-up group overflow-hidden rounded-[1.6rem] border border-[rgba(47,92,69,0.08)] bg-white shadow-[0_18px_40px_rgba(36,49,36,0.05)] transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${(index + 1) * 70}ms` }}>
                  <div className="grid h-full sm:grid-cols-[0.42fr_0.58fr]">
                    <div className="relative aspect-[4/3] overflow-hidden sm:aspect-auto">
                      <Image src={item.image} alt={item.title} fill sizes="(max-width: 1024px) 100vw, 24vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    </div>
                    <div className="space-y-3 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{item.category}</p>
                      <h3 className="text-[1.14rem] leading-7 text-[var(--fg)] transition-colors group-hover:text-[var(--accent)]" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
                      <p className="text-sm leading-7 text-[var(--muted)]">{item.summary}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className={`${shellClassName} py-14 lg:py-16`}>
        <div className="rounded-[1.9rem] border border-[rgba(47,92,69,0.08)] bg-[rgba(63,125,71,0.06)] px-6 py-7 shadow-[0_20px_44px_rgba(36,49,36,0.05)] sm:px-8 sm:py-9">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-[var(--accent)]">更多个体</p>
              <h2 className="mt-4 text-[2rem] leading-tight text-[var(--fg)] sm:text-[2.3rem]" style={{ fontFamily: "var(--font-display)" }}>继续浏览更多熊猫</h2>
              <p className="mt-3 max-w-2xl text-sm leading-8 text-[var(--muted)]">看完一只熊猫之后，最自然的下一步不是结束，而是继续进入同基地、同年龄段或气质完全不同的下一只个体。</p>
            </div>
            <Link href="/atlas" className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(47,92,69,0.18)]">
              浏览完整图鉴
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {experience.recommendations.map((item, index) => (
              <a key={item.name} href={item.href} className="home-fade-up group overflow-hidden rounded-[1.7rem] border border-[rgba(47,92,69,0.08)] bg-white shadow-[0_16px_34px_rgba(36,49,36,0.05)] transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${index * 70}ms` }}>
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image src={item.image} alt={item.name} fill sizes="(max-width: 1024px) 100vw, 30vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div className="space-y-3 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{item.meta}</p>
                  <h3 className="text-[1.2rem] text-[var(--fg)]" style={{ fontFamily: "var(--font-display)" }}>{item.name}</h3>
                  <p className="text-sm leading-7 text-[var(--muted)]">{item.summary}</p>
                </div>
              </a>
            ))}
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
                <p className="text-lg text-[var(--accent)]" style={{ fontFamily: "var(--font-display)" }}>熊猫档案</p>
                <p className="text-sm text-[var(--muted)]">以清晰内容结构组织大熊猫相关知识与档案。</p>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-8 text-[var(--muted)]">详情页延续首页的自然生态风格与轻杂志感，把大图、故事、时间线和延伸阅读组织成一条更完整的浏览链路。</p>
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
