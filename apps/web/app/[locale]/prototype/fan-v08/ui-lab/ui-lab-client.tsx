"use client";

/* eslint-disable @next/next/no-img-element -- prototype compares image-first UI patterns using reviewed fixtures. */

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Images,
  Maximize2,
  Menu,
  MoveHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import "yet-another-react-lightbox/styles.css";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { PhotoGallery, type PhotoGalleryItem } from "@/components/media/photo-gallery";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import { fanV08VisualFixtures } from "../visual-fixtures";
import styles from "./ui-lab.module.css";

interface Props {
  locale: "zh" | "en";
}

interface Candidate {
  name: string;
  source: string;
  sourceUrl: string;
  fit: "adopt" | "adapt" | "skip";
  use: string;
}

const candidates: Candidate[] = [
  { name: "Animated Tabs", source: "Animate UI", sourceUrl: "https://animate-ui.com", fit: "adopt", use: "详情页内容导航 / 分组切换" },
  { name: "Animated Accordion", source: "Animate UI", sourceUrl: "https://animate-ui.com", fit: "adopt", use: "性格、照护、来源的渐进展开" },
  { name: "Animated Tabs Panel", source: "Animate UI", sourceUrl: "https://animate-ui.com", fit: "adopt", use: "同一区域切换不同资料域" },
  { name: "Morphing Detail", source: "Motion Primitives", sourceUrl: "https://github.com/ibelick/motion-primitives", fit: "adapt", use: "点击家族成员查看轻量个体预览" },
  { name: "Drawer", source: "shadcn / Vaul", sourceUrl: "https://ui.shadcn.com/docs/components/drawer", fit: "adopt", use: "移动端资料目录 / 筛选 / 快速资料" },
  { name: "Embla Carousel", source: "Embla Carousel", sourceUrl: "https://www.embla-carousel.com/", fit: "adopt", use: "首页熊猫横向浏览 / 家族横向浏览；交互与拖拽交给成熟 carousel 引擎，视觉由 ZhiPanda 控制" },
  { name: "Gantt timeline model", source: "Kibo UI", sourceUrl: "https://github.com/haydenbleasel/kibo", fit: "adapt", use: "生命轨道中的地点区间 + 事件点" },
  { name: "Image Zoom", source: "Kibo UI", sourceUrl: "https://github.com/haydenbleasel/kibo", fit: "skip", use: "单图放大；已有 Lightbox 后价值重复" },
  { name: "Rows Photo Album", source: "React Photo Album", sourceUrl: "https://github.com/igordanchenko/react-photo-album", fit: "adopt", use: "熊猫影像档案 / 响应式照片墙" },
  { name: "Lightbox + Zoom", source: "Yet Another React Lightbox", sourceUrl: "https://github.com/igordanchenko/yet-another-react-lightbox", fit: "adopt", use: "照片查看、手势、键盘、缩放" },
  { name: "Reel", source: "Kibo UI", sourceUrl: "https://github.com/haydenbleasel/kibo", fit: "skip", use: "适合短视频，不适合成为普通熊猫详情主结构" },
  { name: "Base Accordion", source: "shadcn / Radix", sourceUrl: "https://github.com/shadcn-ui/ui", fit: "adopt", use: "低动效场景和 reduced-motion fallback" },
];

const tabs = [
  { id: "profile", zh: "认识它", en: "Profile" },
  { id: "family", zh: "家族", en: "Family" },
  { id: "life", zh: "一生", en: "Life" },
  { id: "photos", zh: "影像", en: "Photos" },
];

const factGroups = [
  {
    title: "怎么认出思缘",
    body: "两只前掌各有一撮明显白毛，因此有了“白手套妹妹”的昵称。个体识别信息适合用短段落展开，而不是塞进标签和 Badge。",
  },
  {
    title: "性格与日常",
    body: "现有采集记录显示，思缘性格温和、采食慢条斯理。这里应保留观察语境，但视觉上不需要做成独立 Card。",
  },
  {
    title: "成长与照护",
    body: "幼年时期曾接受人工照护。照护信息通常比身份字段更长，适合 Disclosure 或 Accordion 渐进展开。",
  },
];

const family = [
  { name: "奇缘", relation: "母亲", image: fanV08VisualFixtures[3]?.image ?? fanV08VisualFixtures[0].image },
  { name: "师师", relation: "父亲", image: fanV08VisualFixtures[4]?.image ?? fanV08VisualFixtures[1].image },
  { name: "思念", relation: "女儿", image: fanV08VisualFixtures[1].image },
  { name: "思筠筠", relation: "女儿", image: fanV08VisualFixtures[2].image },
];

const lifeEvents = [
  { year: 2004, label: "出生", detail: "10 月 22 日出生于成都大熊猫繁育研究基地。", x: 2 },
  { year: 2004, label: "人工照护", detail: "幼年阶段进入保温箱人工照护。", x: 8 },
  { year: 2015, label: "育幼", detail: "进入重要繁育与育幼阶段。", x: 58 },
  { year: 2024, label: "近况", detail: "继续保留机构公开近况与生活记录。", x: 96 },
];

const residenceBands = [
  { label: "成都", left: 0, width: 66 },
  { label: "后续居住记录", left: 66, width: 34 },
];

function fitLabel(fit: Candidate["fit"], zh: boolean) {
  if (fit === "adopt") return zh ? "采用" : "Adopt";
  if (fit === "adapt") return zh ? "改造采用" : "Adapt";
  return zh ? "不采用" : "Skip";
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className={styles.sourceLink} href={href} target="_blank" rel="noreferrer">
      {children}<ExternalLink aria-hidden="true" />
    </a>
  );
}

function SmoothTabs({ zh }: { zh: boolean }) {
  return (
    <Tabs defaultValue="profile" className={styles.smoothTabsShared}>
      <TabsList className={styles.smoothTabs} aria-label={zh ? "详情页内容导航" : "Profile section navigation"}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {zh ? tab.zh : tab.en}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function DisclosureSpike({ zh }: { zh: boolean }) {
  return (
    <div>
      <Accordion type="single" collapsible defaultValue="fact-0" className={styles.disclosureList}>
        {factGroups.map((fact, index) => (
          <AccordionItem key={fact.title} value={`fact-${index}`} className={styles.disclosureItem}>
            <AccordionTrigger>{fact.title}</AccordionTrigger>
            <AccordionContent className={styles.disclosureBody}>
              <p>{fact.body}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className={styles.microcopy}>{zh ? "适合：事实很多但不希望页面无限变长。" : "Best for dense facts without making the page endlessly long."}</p>
    </div>
  );
}

function TransitionPanelSpike({ zh }: { zh: boolean }) {
  const items = [
    { value: "appearance", label: zh ? "识别特征" : "Recognition", body: zh ? "前掌白毛是最容易记住的识别点。" : "White fur on the front paws is the clearest visual cue." },
    { value: "daily", label: zh ? "性格与日常" : "Daily life", body: zh ? "性格温和，采食节奏慢。" : "Calm temperament and an unhurried eating pace." },
    { value: "care", label: zh ? "成长照护" : "Care", body: zh ? "幼年阶段曾接受人工照护。" : "Received hand-rearing care as a cub." },
  ];

  return (
    <Tabs defaultValue="appearance" className={styles.transitionPanel}>
      <TabsList className={styles.segmentedControl}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContents className={styles.panelStage}>
        {items.map((item) => (
          <TabsContent key={item.value} value={item.value}>
            <div className={styles.panelCopy}>
              <strong>{item.label}</strong>
              <p>{item.body}</p>
            </div>
          </TabsContent>
        ))}
      </TabsContents>
    </Tabs>
  );
}

function FamilyRail({ zh }: { zh: boolean }) {
  const [selected, setSelected] = useState(0);
  return (
    <div>
      <div className={styles.familyRail}>
        {family.map((person, index) => (
          <button key={person.name} type="button" className={styles.familyPerson} onClick={() => setSelected(index)} aria-pressed={selected === index}>
            <img src={person.image} alt="" />
            <span><strong>{person.name}</strong><small>{person.relation}</small></span>
            <ArrowRight aria-hidden="true" />
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={family[selected].name} className={styles.familyPreview} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <img src={family[selected].image} alt="" />
          <div><span>{family[selected].relation}</span><strong>{family[selected].name}</strong><p>{zh ? "用于详情页内的轻量关系预览；点击后仍可进入完整个体页。" : "A lightweight relation preview that can still link to the full profile."}</p></div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function LifeBandSpike({ zh }: { zh: boolean }) {
  const [selected, setSelected] = useState(0);
  const event = lifeEvents[selected];
  return (
    <div className={styles.lifeSpike}>
      <div className={styles.lifeScale} aria-label={zh ? "生命时间轴试验" : "Life timeline experiment"}>
        <div className={styles.bandRow}>
          {residenceBands.map((band) => <span key={band.label} style={{ left: `${band.left}%`, width: `${band.width}%` }}>{band.label}</span>)}
        </div>
        <div className={styles.lifeRail} />
        {lifeEvents.map((item, index) => (
          <button key={`${item.year}:${item.label}`} type="button" className={styles.lifePoint} style={{ left: `${item.x}%` }} onClick={() => setSelected(index)} aria-pressed={selected === index}>
            <span className={styles.lifeDot} />
            <strong>{item.year}</strong>
            <small>{item.label}</small>
          </button>
        ))}
      </div>
      <div className={styles.lifeDetail}><span>{event.year}</span><strong>{event.label}</strong><p>{event.detail}</p></div>
    </div>
  );
}

function DrawerSpike({ zh }: { zh: boolean }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button type="button" className={styles.actionButton}>
          <Menu aria-hidden="true" />
          {zh ? "打开移动资料目录" : "Open mobile profile menu"}
        </button>
      </DrawerTrigger>

      <DrawerContent className={styles.drawerContent}>
        <DrawerHeader className={styles.drawerHeader}>
          <DrawerTitle>{zh ? "思缘 · 快速目录" : "Si Yuan · Quick profile"}</DrawerTitle>
          <DrawerDescription>
            {zh
              ? "shadcn / Vaul 提供手势和 Drawer 行为；视觉完全由 PandaAtlas 控制。"
              : "shadcn / Vaul owns drawer behavior and gestures; PandaAtlas owns the visual system."}
          </DrawerDescription>
        </DrawerHeader>

        <nav className={styles.sharedDrawerNav}>
          {["关于思缘", "家族", "生命轨道", "成长与照护", "影像档案"].map((item, index) => (
            <button type="button" key={item}>
              <span>0{index + 1}</span>{item}
            </button>
          ))}
        </nav>

        <DrawerFooter className={styles.drawerFooter}>
          <DrawerClose asChild>
            <button type="button" className={styles.drawerClose}>
              {zh ? "关闭" : "Close"}
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function UiLabClient({ locale }: Props) {
  const zh = locale === "zh";
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const photos = useMemo<PhotoGalleryItem[]>(() => fanV08VisualFixtures.map((fixture, index) => ({
    src: fixture.image,
    width: index % 3 === 0 ? 1200 : index % 3 === 1 ? 900 : 1100,
    height: index % 3 === 0 ? 900 : index % 3 === 1 ? 1200 : 820,
    alt: zh ? fixture.zh : fixture.en,
  })), [zh]);

  const lightboxSlides = useMemo(() => photos.map((photo) => ({ src: photo.src, width: photo.width, height: photo.height, alt: photo.alt })), [photos]);

  return (
    <div className={styles.page} data-testid="fan-v08-ui-lab">
      <header className={styles.header}>
        <Link href={`/${locale}/prototype/fan-v08`} className={styles.back}><ArrowLeft aria-hidden="true" />Fan V8</Link>
        <div><span>吱熊猫 ZhiPanda</span><strong>UI component lab</strong></div>
        <SourceLink href="https://github.com/shadcn-ui/ui">shadcn baseline</SourceLink>
      </header>

      <main>
        <section className={styles.intro}>
          <p className={styles.kicker}>UI SPIKE · 2026</p>
          <h1>{zh ? "哪些组件真的适合熊猫网站？" : "Which components actually fit a panda website?"}</h1>
          <p>{zh ? "这里不展示“组件库有多炫”，只把开源组件放进 PandaAtlas 的真实内容场景：熊猫照片、个体资料、家族、生命轨道和移动端浏览。" : "This lab judges open-source components inside real PandaAtlas content: panda photography, profile facts, family, life history and mobile browsing."}</p>
        </section>

        <section className={styles.scoreSection}>
          <div className={styles.sectionTitle}><span>01</span><div><h2>{zh ? "候选组件结论" : "Candidate verdicts"}</h2><p>{zh ? "先决定“拿不拿”，再决定“长什么样”。" : "First decide what to own; styling comes second."}</p></div></div>
          <div className={styles.scoreTable}>
            {candidates.map((candidate) => (
              <div key={`${candidate.source}:${candidate.name}`} className={styles.scoreRow}>
                <span className={`${styles.fit} ${styles[candidate.fit]}`}>{fitLabel(candidate.fit, zh)}</span>
                <strong>{candidate.name}</strong>
                <span>{candidate.use}</span>
                <SourceLink href={candidate.sourceUrl}>{candidate.source}</SourceLink>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.demoSection}>
          <div className={styles.sectionTitle}><span>02</span><div><h2>{zh ? "导航与信息展开" : "Navigation & disclosure"}</h2><p>{zh ? "Animate UI + shadcn 负责成熟交互，PandaAtlas 负责视觉语言。" : "Animate UI and shadcn own mature interaction primitives; PandaAtlas owns the visual language."}</p></div></div>
          <div className={styles.twoCol}>
            <article className={styles.demoBlock}>
              <div className={styles.demoHead}><div><span>Animate UI</span><h3>Animated Tabs</h3></div><span className={styles.keepBadge}>ADOPT</span></div>
              <SmoothTabs zh={zh} />
              <p className={styles.demoNote}>{zh ? "适合详情页固定导航；只保留滑动指示器和 Motion 行为，不采用产品化 pill 外观。" : "Good for profile navigation; keep the sliding indicator, not the SaaS pill styling."}</p>
            </article>
            <article className={styles.demoBlock}>
              <div className={styles.demoHead}><div><span>Animate UI</span><h3>Animated Accordion</h3></div><span className={styles.keepBadge}>ADOPT</span></div>
              <DisclosureSpike zh={zh} />
            </article>
          </div>
          <article className={styles.demoBlockWide}>
            <div className={styles.demoHead}><div><span>Animate UI</span><h3>Animated Tabs Panel</h3></div><span className={styles.keepBadge}>ADOPT</span></div>
            <TransitionPanelSpike zh={zh} />
          </article>
        </section>

        <section className={styles.demoSection}>
          <div className={styles.sectionTitle}><span>03</span><div><h2>{zh ? "家族与生命关系" : "Family & life relationships"}</h2><p>{zh ? "这里应该“借交互模型”，不借默认视觉。" : "Borrow interaction models here, not default visual skins."}</p></div></div>
          <article className={styles.demoBlockWide}>
            <div className={styles.demoHead}><div><span>Embla Carousel + Motion morph</span><h3>{zh ? "家族人物横向浏览" : "Family relation rail"}</h3></div><span className={styles.keepBadge}>ADOPT</span></div>
            <FamilyRail zh={zh} />
          </article>
          <article className={styles.demoBlockWide}>
            <div className={styles.demoHead}><div><span>Kibo Gantt model</span><h3>{zh ? "生命轨道 + 居住区间" : "Life track + residence bands"}</h3></div><span className={styles.adaptBadge}>ADAPT</span></div>
            <LifeBandSpike zh={zh} />
          </article>
        </section>

        <section className={styles.demoSection}>
          <div className={styles.sectionTitle}><span>04</span><div><h2>{zh ? "影像系统" : "Photography system"}</h2><p>{zh ? "这是我认为最应该直接进入 PandaAtlas 的现成库。" : "These are the strongest candidates for direct adoption."}</p></div></div>
          <article className={styles.demoBlockWide}>
            <div className={styles.demoHead}><div><span>React Photo Album</span><h3>Rows Photo Album</h3></div><span className={styles.keepBadge}>ADOPT</span></div>
            <PhotoGallery
              photos={photos}
              openLabel={zh ? "打开熊猫照片" : "Open panda photo"}
              targetRowHeight={230}
            />
            <div className={styles.photoActions}><span><Images aria-hidden="true" />{zh ? "响应式行布局" : "Responsive rows"}</span><span><Maximize2 aria-hidden="true" />{zh ? "点击打开 Lightbox" : "Click opens Lightbox"}</span></div>
          </article>
          <article className={styles.demoBlockWide}>
            <div className={styles.demoHead}><div><span>Yet Another React Lightbox</span><h3>Lightbox + Zoom</h3></div><span className={styles.keepBadge}>ADOPT</span></div>
            <div className={styles.lightboxPitch}>
              <div><strong>{zh ? "把图片查看交给专业库" : "Let a specialist own image viewing"}</strong><p>{zh ? "键盘、触摸、预加载、响应式图片和缩放都已有成熟实现；我们只定义背景、caption 和工具栏风格。" : "Keyboard, touch, preloading, responsive images and zoom are solved; we only own the visual treatment."}</p></div>
              <button type="button" className={styles.actionButton} onClick={() => setLightboxIndex(0)}><Maximize2 aria-hidden="true" />{zh ? "打开查看器" : "Open viewer"}</button>
            </div>
          </article>
        </section>

        <section className={styles.demoSection}>
          <div className={styles.sectionTitle}><span>05</span><div><h2>{zh ? "移动端 Drawer" : "Mobile drawer"}</h2><p>{zh ? "行为交给 Vaul，内容和风格归 PandaAtlas。" : "Vaul owns behavior; PandaAtlas owns content and styling."}</p></div></div>
          <article className={styles.demoBlockWide}>
            <div className={styles.drawerPitch}><MoveHorizontal aria-hidden="true" /><div><strong>{zh ? "底部手势比侧边栏更适合手机" : "A bottom gesture works better than a sidebar on phones"}</strong><p>{zh ? "可用于详情目录、过滤器、快速资料，不把桌面导航生硬缩成汉堡菜单。" : "Useful for profile navigation, filters and quick facts without squeezing desktop navigation into a hamburger."}</p></div><DrawerSpike zh={zh} /></div>
          </article>
        </section>

        <section className={styles.decisionSection}>
          <p className={styles.kicker}>RECOMMENDED STACK</p>
          <h2>{zh ? "第一批正式进入 PandaAtlas 的组件" : "First components to graduate into PandaAtlas"}</h2>
          <div className={styles.decisionGrid}>
            {["Animate UI Tabs", "Animate UI Accordion", "Animate UI Tabs Panel", "shadcn Drawer / Vaul", "Embla Carousel", "React Photo Album", "Yet Another React Lightbox", "Life Track range model"].map((item, index) => (
              <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
            ))}
          </div>
          <p>{zh ? "Kibo 的 Reel / Image Zoom 暂不引入；Magic UI、Spotlight、Bento 等效果只在最新原型明确需要时选择性使用，不作为公共页面默认结构。" : "Kibo Reel/Image Zoom stay out for now; Magic UI, spotlight and bento-like effects remain selective tools rather than default public-page structure."}</p>
        </section>
      </main>

      <Lightbox
        className={styles.lightbox}
        open={lightboxIndex >= 0}
        index={Math.max(0, lightboxIndex)}
        close={() => setLightboxIndex(-1)}
        slides={lightboxSlides}
        plugins={[Zoom]}
        carousel={{ finite: false }}
        controller={{ closeOnBackdropClick: true }}
      />
    </div>
  );
}
