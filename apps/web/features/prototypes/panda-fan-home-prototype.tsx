"use client";

import type { CSSProperties } from "react";
import { useEffect, useId, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  MapPin,
  Network,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import type { PublicLocale } from "@/foundation/content/locales";
import { PandaFanBrandStoryVariant } from "./panda-fan-brand-story-variant";

const photos = {
  lunLun: "https://api.zhipanda.com/media/releases/2026.07.20.1/media-lun-lun-a089c7f24bdfbc26-w1200.webp",
  yangYang: "https://api.zhipanda.com/media/releases/2026.07.20.1/media-yang-yang-8e30a6c81892cbde-w1200.webp",
  yaLun: "https://api.zhipanda.com/media/releases/2026.07.20.1/media-ya-lun-4006c2e608f8e671-w1200.webp",
} as const;

const pandas = [
  { id: "lun-lun", name: "伦伦", en: "Lun Lun", place: "成都", photo: photos.lunLun },
  { id: "yang-yang", name: "洋洋", en: "Yang Yang", place: "成都", photo: photos.yangYang },
  { id: "ya-lun", name: "雅伦", en: "Ya Lun", place: "成都", photo: photos.yaLun },
] as const;

const updates = [
  { panda: "伦伦", time: "今天", title: "从她的七个孩子开始，认识伦伦家族", type: "家族故事", photo: photos.lunLun },
  { panda: "雅伦", time: "昨天", title: "雅伦的资料新增了一组公开照片", type: "新照片", photo: photos.yaLun },
  { panda: "洋洋", time: "3 天前", title: "沿着生活地点回看洋洋的旅居经历", type: "生活足迹", photo: photos.yangYang },
] as const;

const variants = [
  { key: "A", name: "生活杂志" },
  { key: "B", name: "关注客厅" },
  { key: "C", name: "探索地图" },
  { key: "D", name: "潮流品牌叙事" },
] as const;

type VariantKey = (typeof variants)[number]["key"];

function isVariantKey(value: string | null): value is VariantKey {
  return variants.some((variant) => variant.key === value);
}

function photoStyle(url: string, position = "center"): CSSProperties {
  return {
    backgroundImage: `linear-gradient(180deg, rgba(17, 38, 29, 0.02), rgba(17, 38, 29, 0.48)), url("${url}")`,
    backgroundPosition: position,
  };
}

function PrototypePhoto({
  src,
  label,
  className = "",
  position,
}: {
  src: string;
  label: string;
  className?: string;
  position?: string;
}) {
  return (
    <div
      className={`zp-proto-photo ${className}`}
      role="img"
      aria-label={label}
      style={photoStyle(src, position)}
    />
  );
}

function FollowButton({ panda, compact = false }: { panda: string; compact?: boolean }) {
  const [following, setFollowing] = useState(false);
  return (
    <button
      type="button"
      className={`zp-proto-follow ${following ? "is-following" : ""} ${compact ? "is-compact" : ""}`}
      aria-pressed={following}
      onClick={() => setFollowing((value) => !value)}
    >
      <Heart aria-hidden="true" fill={following ? "currentColor" : "none"} />
      {following ? `已关注${panda}` : `关注${panda}`}
    </button>
  );
}

function SearchBox({ label = "搜索熊猫名字、昵称或机构" }: { label?: string }) {
  const inputId = useId();
  return (
    <form className="zp-proto-search" role="search" onSubmit={(event) => event.preventDefault()}>
      <Search aria-hidden="true" />
      <label className="zp-proto-sr-only" htmlFor={inputId}>{label}</label>
      <input id={inputId} type="search" placeholder={label} />
      <button type="submit">寻找熊猫</button>
    </form>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: string;
}) {
  return (
    <div className="zp-proto-section-heading">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action ? (
        <button type="button" className="zp-proto-text-button">
          {action}<ArrowRight aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function VariantA() {
  return (
    <div className="zp-proto-page zp-proto-magazine" data-variant="A">
      <section className="zp-proto-a-hero">
        <div className="zp-proto-a-hero-copy">
          <p className="zp-proto-kicker"><Sparkles aria-hidden="true" /> 本周主角</p>
          <h1>从喜欢的一只熊猫，认识整个家族。</h1>
          <p className="zp-proto-lede">看照片、读近况、顺着家族与生活地点继续发现。今天，从伦伦开始。</p>
          <div className="zp-proto-actions">
            <button type="button" className="zp-proto-primary">认识伦伦<ArrowRight aria-hidden="true" /></button>
            <FollowButton panda="伦伦" />
          </div>
          <SearchBox />
        </div>
        <div className="zp-proto-a-hero-media">
          <PrototypePhoto src={photos.lunLun} label="伦伦的公开照片" className="zp-proto-a-main-photo" position="center 28%" />
          <div className="zp-proto-a-photo-caption">
            <span>伦伦 · Lun Lun</span>
            <strong>七个孩子的妈妈</strong>
            <small>公开媒体示意 · 原型</small>
          </div>
          <div className="zp-proto-a-sticker">认识这一家<br /><strong>3 代</strong></div>
        </div>
      </section>

      <section className="zp-proto-band zp-proto-a-following">
        <div className="zp-proto-shell">
          <div className="zp-proto-a-following-intro">
            <span className="zp-proto-icon-bubble"><Heart aria-hidden="true" /></span>
            <div>
              <p>你的熊猫世界</p>
              <h2>关注之后，每次回来都有新发现。</h2>
            </div>
          </div>
          <div className="zp-proto-a-following-list">
            {pandas.map((panda) => (
              <article key={panda.id}>
                <PrototypePhoto src={panda.photo} label={`${panda.name}的公开照片`} />
                <div>
                  <strong>{panda.name}</strong>
                  <span>{panda.en} · {panda.place}</span>
                </div>
                <FollowButton panda={panda.name} compact />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="zp-proto-shell zp-proto-section">
        <SectionHeading eyebrow="最近发生" title="熊猫动态，不只是资料更新" action="查看全部动态" />
        <div className="zp-proto-a-editorial-grid">
          <article className="zp-proto-a-feature-story">
            <PrototypePhoto src={photos.yaLun} label="雅伦的公开照片" className="zp-proto-a-story-photo" position="center 34%" />
            <div>
              <span className="zp-proto-tag zp-proto-tag-orange">新照片</span>
              <h3>雅伦：从双胞胎姐妹，到家族中的新一代</h3>
              <p>用一组照片和清楚的家族关系，快速认识伦伦与洋洋的女儿。</p>
              <button type="button" className="zp-proto-text-button">读她的故事<ArrowRight aria-hidden="true" /></button>
            </div>
          </article>
          <div className="zp-proto-a-story-stack">
            {updates.slice(0, 2).map((update) => (
              <article key={update.title}>
                <PrototypePhoto src={update.photo} label={`${update.panda}的公开照片`} />
                <div>
                  <span>{update.type} · {update.time}</span>
                  <h3>{update.title}</h3>
                  <button type="button" aria-label={`打开：${update.title}`}><ArrowRight aria-hidden="true" /></button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="zp-proto-shell zp-proto-section">
        <SectionHeading eyebrow="继续探索" title="一只熊猫，可以带你去很多地方" />
        <div className="zp-proto-a-explore-grid">
          <article className="zp-proto-a-family-card">
            <div className="zp-proto-a-family-top">
              <span className="zp-proto-icon-bubble"><Network aria-hidden="true" /></span>
              <span>家族故事</span>
            </div>
            <h3>伦伦与洋洋一家</h3>
            <p>从父母到七个孩子，用照片卡片认识这个跨越多年的熊猫家庭。</p>
            <div className="zp-proto-avatar-row">
              {pandas.map((panda) => <PrototypePhoto key={panda.id} src={panda.photo} label={panda.name} />)}
              <span>+ 6</span>
            </div>
            <button type="button" className="zp-proto-primary">看看这个家族<ArrowRight aria-hidden="true" /></button>
          </article>
          <article className="zp-proto-a-place-card">
            <span className="zp-proto-icon-bubble"><MapPin aria-hidden="true" /></span>
            <div>
              <span>生活过的地方</span>
              <h3>从亚特兰大到成都</h3>
              <p>沿着公开记录中的生活地点，认识与这些地方有关的熊猫。</p>
            </div>
            <div className="zp-proto-a-route" aria-label="亚特兰大到成都的地点关系示意">
              <span>亚特兰大</span><i /><span>成都</span>
            </div>
            <button type="button" className="zp-proto-secondary">打开地点探索<ArrowRight aria-hidden="true" /></button>
          </article>
          <article className="zp-proto-a-random-card">
            <Compass aria-hidden="true" />
            <p>今天认识谁？</p>
            <h3>随机遇见一只熊猫</h3>
            <button type="button">带我去看看<ArrowRight aria-hidden="true" /></button>
          </article>
        </div>
      </section>
    </div>
  );
}

function VariantB() {
  return (
    <div className="zp-proto-page zp-proto-lounge" data-variant="B">
      <section className="zp-proto-shell zp-proto-b-welcome">
        <div>
          <p className="zp-proto-kicker"><Heart aria-hidden="true" /> 我的熊猫客厅</p>
          <h1>早上好，来看看你关注的熊猫。</h1>
          <p>三只关注熊猫有新内容，伦伦家族本周新增一篇故事。</p>
        </div>
        <SearchBox label="搜索更多熊猫加入关注" />
      </section>

      <section className="zp-proto-shell zp-proto-b-layout">
        <aside className="zp-proto-b-sidebar" aria-label="关注的熊猫">
          <div className="zp-proto-b-side-heading">
            <div>
              <p>正在关注</p>
              <strong>3 只熊猫</strong>
            </div>
            <button type="button" aria-label="管理关注"><Users aria-hidden="true" /></button>
          </div>
          <div className="zp-proto-b-pandas">
            {pandas.map((panda, index) => (
              <button type="button" key={panda.id} className={index === 0 ? "is-active" : ""}>
                <PrototypePhoto src={panda.photo} label={panda.name} />
                <span><strong>{panda.name}</strong><small>{panda.place}</small></span>
                {index < 2 ? <i aria-label="有新动态" /> : null}
              </button>
            ))}
          </div>
          <button type="button" className="zp-proto-b-add"><Heart aria-hidden="true" />发现更多熊猫</button>
          <div className="zp-proto-b-birthday">
            <CalendarDays aria-hidden="true" />
            <div><span>下一个生日</span><strong>还有 16 天</strong><small>一起看看本月生日熊猫</small></div>
          </div>
        </aside>

        <main className="zp-proto-b-feed" aria-label="关注动态">
          <div className="zp-proto-b-feed-heading">
            <div><p>今天</p><h2>你的关注动态</h2></div>
            <div className="zp-proto-segmented" aria-label="动态筛选">
              <button type="button" className="is-active">全部</button>
              <button type="button">照片</button>
              <button type="button">家族</button>
            </div>
          </div>

          <article className="zp-proto-b-spotlight">
            <PrototypePhoto src={photos.lunLun} label="伦伦的公开照片" className="zp-proto-b-spotlight-photo" position="center 30%" />
            <div className="zp-proto-b-spotlight-copy">
              <div className="zp-proto-b-update-meta"><span className="zp-proto-avatar-mini">伦</span><span><strong>伦伦</strong><small>家族故事 · 今天</small></span></div>
              <h3>她的七个孩子，现在都在哪里？</h3>
              <p>从美兰到双胞胎雅伦和喜伦，一次看懂伦伦与洋洋一家。</p>
              <div className="zp-proto-b-card-actions">
                <button type="button" className="zp-proto-primary">打开家族故事<ArrowRight aria-hidden="true" /></button>
                <button type="button" className="zp-proto-icon-button" aria-label="收藏"><Heart aria-hidden="true" /></button>
              </div>
            </div>
          </article>

          <div className="zp-proto-b-update-list">
            {updates.slice(1).map((update) => (
              <article key={update.title}>
                <PrototypePhoto src={update.photo} label={`${update.panda}的公开照片`} />
                <div className="zp-proto-b-update-body">
                  <span>{update.type} · {update.time}</span>
                  <h3>{update.title}</h3>
                  <p>继续查看熊猫资料、相关照片和与它有关的熊猫。</p>
                </div>
                <button type="button" className="zp-proto-icon-button" aria-label={`打开：${update.title}`}><ArrowRight aria-hidden="true" /></button>
              </article>
            ))}
          </div>

          <article className="zp-proto-b-discovery-prompt">
            <span className="zp-proto-icon-bubble"><Compass aria-hidden="true" /></span>
            <div><p>跳出关注列表</p><h3>认识一只与你关注的熊猫有关的新朋友</h3><span>因为你关注了伦伦，我们为你准备了她的家族成员。</span></div>
            <button type="button" className="zp-proto-secondary">开始发现<ArrowRight aria-hidden="true" /></button>
          </article>
        </main>

        <aside className="zp-proto-b-right-rail" aria-label="今日活动">
          <div className="zp-proto-b-rail-card">
            <Bell aria-hidden="true" />
            <p>今日提醒</p>
            <h3>雅伦新增照片</h3>
            <span>你关注的熊猫有一组新的公开媒体。</span>
            <button type="button">查看照片</button>
          </div>
          <div className="zp-proto-b-rail-card is-yellow">
            <Camera aria-hidden="true" />
            <p>照片精选</p>
            <h3>本周最值得看的 8 张照片</h3>
            <button type="button">打开精选</button>
          </div>
          <div className="zp-proto-b-quiet-note">
            <strong>关于动态</strong>
            <p>这里只展示经过整理的公开内容，不是未经确认的实时消息。</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function VariantC() {
  const [focus, setFocus] = useState<(typeof pandas)[number]>(pandas[0]);
  return (
    <div className="zp-proto-page zp-proto-explorer" data-variant="C">
      <section className="zp-proto-c-hero">
        <div className="zp-proto-shell zp-proto-c-hero-inner">
          <div>
            <p className="zp-proto-kicker"><Compass aria-hidden="true" /> 熊猫探索</p>
            <h1>选一只熊猫，沿着关系继续走。</h1>
            <p>家族、地点和生活经历不是三个孤立页面，而是一条可以不断发现的路线。</p>
          </div>
          <SearchBox label="输入一只熊猫，开始探索" />
        </div>
      </section>

      <section className="zp-proto-shell zp-proto-c-workspace">
        <aside className="zp-proto-c-focus-card">
          <p>当前焦点</p>
          <PrototypePhoto src={focus.photo} label={`${focus.name}的公开照片`} className="zp-proto-c-focus-photo" position="center 28%" />
          <div className="zp-proto-c-focus-copy">
            <span>{focus.en}</span>
            <h2>{focus.name}</h2>
            <p>{focus.id === "lun-lun" ? "伦伦与洋洋一家中的母亲，曾生活在亚特兰大，现已返回成都。" : `${focus.name}是这个探索路径中的相关熊猫。`}</p>
            <FollowButton panda={focus.name} />
          </div>
          <div className="zp-proto-c-path">
            <span>你的路径</span>
            <ol><li>今日推荐</li><li>{focus.name}</li></ol>
          </div>
        </aside>

        <div className="zp-proto-c-canvas">
          <div className="zp-proto-c-canvas-toolbar">
            <div className="zp-proto-segmented">
              <button type="button" className="is-active"><Network aria-hidden="true" />家族</button>
              <button type="button"><MapPin aria-hidden="true" />地点</button>
              <button type="button"><Sparkles aria-hidden="true" />主题</button>
            </div>
            <button type="button" className="zp-proto-c-list-toggle">查看列表</button>
          </div>

          <div className="zp-proto-c-network" aria-label="伦伦家族关系探索示意">
            <div className="zp-proto-c-orbit orbit-one" />
            <div className="zp-proto-c-orbit orbit-two" />
            <button type="button" className="zp-proto-c-node is-focus" onClick={() => setFocus(pandas[0])}>
              <PrototypePhoto src={photos.lunLun} label="伦伦" /><span>伦伦<small>当前焦点</small></span>
            </button>
            <button type="button" className="zp-proto-c-node node-partner" onClick={() => setFocus(pandas[1])}>
              <PrototypePhoto src={photos.yangYang} label="洋洋" /><span>洋洋<small>配偶</small></span>
            </button>
            <button type="button" className="zp-proto-c-node node-child" onClick={() => setFocus(pandas[2])}>
              <PrototypePhoto src={photos.yaLun} label="雅伦" /><span>雅伦<small>女儿</small></span>
            </button>
            <button type="button" className="zp-proto-c-node node-more">
              <span className="zp-proto-c-more-circle">+ 6</span><span>更多孩子<small>继续展开</small></span>
            </button>
            <div className="zp-proto-c-place-node"><MapPin aria-hidden="true" /><span>亚特兰大<small>曾生活</small></span></div>
            <div className="zp-proto-c-place-node place-current"><MapPin aria-hidden="true" /><span>成都<small>最近记录</small></span></div>
          </div>

          <div className="zp-proto-c-mobile-list">
            {pandas.map((panda) => (
              <button type="button" key={panda.id} onClick={() => setFocus(panda)}>
                <PrototypePhoto src={panda.photo} label={panda.name} />
                <span><strong>{panda.name}</strong><small>{panda.en} · 与伦伦有关</small></span>
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="zp-proto-shell zp-proto-section zp-proto-c-next">
        <SectionHeading eyebrow="下一步" title={`从${focus.name}继续探索`} />
        <div className="zp-proto-c-next-grid">
          <article><span className="zp-proto-icon-bubble"><Users aria-hidden="true" /></span><div><p>家族</p><h3>认识与{focus.name}有关的熊猫</h3><span>父母、伴侣、孩子与同代成员</span></div><button type="button"><ArrowRight aria-hidden="true" /></button></article>
          <article><span className="zp-proto-icon-bubble"><MapPin aria-hidden="true" /></span><div><p>地点</p><h3>看看它生活过的地方</h3><span>地点卡片与同地熊猫</span></div><button type="button"><ArrowRight aria-hidden="true" /></button></article>
          <article><span className="zp-proto-icon-bubble"><Sparkles aria-hidden="true" /></span><div><p>主题</p><h3>发现相似经历的熊猫</h3><span>同年出生、旅居与家族故事</span></div><button type="button"><ArrowRight aria-hidden="true" /></button></article>
        </div>
      </section>
    </div>
  );
}

function PrototypeSwitcher({ current, onChange }: { current: VariantKey; onChange: (variant: VariantKey) => void }) {
  const index = variants.findIndex((variant) => variant.key === current);
  const move = (direction: -1 | 1) => {
    const next = variants[(index + direction + variants.length) % variants.length];
    onChange(next.key);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (process.env.NODE_ENV === "production") return null;

  const selected = variants[index];
  return (
    <div className="zp-proto-switcher" aria-label="原型变体切换器">
      <button type="button" onClick={() => move(-1)} aria-label="上一个变体"><ChevronLeft aria-hidden="true" /></button>
      <div><small>THROWAWAY PROTOTYPE</small><strong>{selected.key} — {selected.name}</strong></div>
      <button type="button" onClick={() => move(1)} aria-label="下一个变体"><ChevronRight aria-hidden="true" /></button>
    </div>
  );
}

export function PandaFanHomePrototype({ locale }: { locale: PublicLocale }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawVariant = searchParams.get("variant");
  const current: VariantKey = isVariantKey(rawVariant) ? rawVariant : "A";

  const setVariant = (variant: VariantKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", variant);
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
  };

  return (
    <main id="main-content" className="zp-proto-root" lang={locale === "zh" ? "zh-CN" : "en"}>
      {current === "D" ? null : (
        <div className="zp-proto-notice">
          <span>原型</span>
          <p>四个首页方向，用于比较“视觉品质、关注关系、探索体验”和品牌叙事的组合方式。页面内容为评审示意。</p>
        </div>
      )}
      {current === "A" ? <VariantA /> : null}
      {current === "B" ? <VariantB /> : null}
      {current === "C" ? <VariantC /> : null}
      {current === "D" ? <PandaFanBrandStoryVariant /> : null}
      <PrototypeSwitcher current={current} onChange={setVariant} />
    </main>
  );
}
