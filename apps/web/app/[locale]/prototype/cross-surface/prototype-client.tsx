"use client";

import type { Route } from "next";
import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Database,
  ExternalLink,
  FileSearch,
  GitBranch,
  Globe2,
  ImageOff,
  Languages,
  ListTree,
  LoaderCircle,
  MapPinned,
  Menu,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./prototype.module.css";

type Locale = "zh" | "en";
type VariantKey = "A" | "B" | "C";
type SurfaceKey = "home" | "atlas" | "profile" | "lineage" | "map";
type ScenarioKey = "live" | "loading" | "empty" | "error" | "no-media" | "cached" | "partial";

interface CrossSurfacePrototypeProps {
  locale: Locale;
}

interface VariantProps {
  locale: Locale;
  surface: SurfaceKey;
  scenario: ScenarioKey;
  onSurfaceChange: (surface: SurfaceKey) => void;
  onLocaleChange: () => void;
}

const VARIANTS: Array<{ key: VariantKey; zh: string; en: string; noteZh: string; noteEn: string }> = [
  {
    key: "A",
    zh: "温暖档案",
    en: "Living Archive",
    noteZh: "编辑性入口与事实档案共享章节、纸张和来源轨道。",
    noteEn: "Editorial entry points and factual records share chapters, paper and provenance rails.",
  },
  {
    key: "B",
    zh: "证据台账",
    en: "Evidence Ledger",
    noteZh: "高密度、低装饰；状态、版本和来源先于叙事。",
    noteEn: "Dense and restrained; status, version and sources precede narrative.",
  },
  {
    key: "C",
    zh: "路径图谱",
    en: "Trail Atlas",
    noteZh: "用实体、关系和场所之间的路径组织跨页面探索。",
    noteEn: "Cross-surface exploration is organized as trails between entities, relations and places.",
  },
];

const SURFACES: Array<{ key: SurfaceKey; zh: string; en: string }> = [
  { key: "home", zh: "首页", en: "Home" },
  { key: "atlas", zh: "图鉴", en: "Atlas" },
  { key: "profile", zh: "档案", en: "Profile" },
  { key: "lineage", zh: "家族", en: "Lineage" },
  { key: "map", zh: "地图", en: "Map" },
];

const SCENARIOS: Array<{ key: ScenarioKey; zh: string; en: string }> = [
  { key: "live", zh: "正常发布", en: "Live" },
  { key: "loading", zh: "加载", en: "Loading" },
  { key: "empty", zh: "空结果", en: "Empty" },
  { key: "error", zh: "错误", en: "Error" },
  { key: "no-media", zh: "无许可媒体", en: "No media" },
  { key: "cached", zh: "缓存降级", en: "Cached" },
  { key: "partial", zh: "部分结果", en: "Partial" },
];

const PANDAS = [
  {
    id: "mei-xiang",
    zh: "美香",
    en: "Mei Xiang",
    bornZh: "1998 年 7 月 22 日",
    bornEn: "22 July 1998",
    placeZh: "中国（仅确认到国家级）",
    placeEn: "China (country-level only)",
    status: "confirmed",
  },
  {
    id: "tian-tian",
    zh: "添添",
    en: "Tian Tian",
    bornZh: "1997 年 8 月 27 日",
    bornEn: "27 August 1997",
    placeZh: "中国（仅确认到国家级）",
    placeEn: "China (country-level only)",
    status: "confirmed",
  },
  {
    id: "xiao-qi-ji",
    zh: "小奇迹",
    en: "Xiao Qi Ji",
    bornZh: "2020 年 8 月 21 日",
    bornEn: "21 August 2020",
    placeZh: "卧龙神树坪基地",
    placeEn: "Wolong Shenshuping Base",
    status: "confirmed",
  },
];

const RELATIONS = [
  { roleZh: "母亲", roleEn: "Mother", zh: "美香", en: "Mei Xiang", state: "confirmed" },
  { roleZh: "父亲", roleEn: "Father", zh: "添添", en: "Tian Tian", state: "confirmed" },
  { roleZh: "外孙", roleEn: "Grandchild", zh: "宝力", en: "Bao Li", state: "provisional" },
];

const LOCATIONS = [
  {
    zh: "史密森尼国家动物园",
    en: "Smithsonian’s National Zoo",
    metaZh: "2000-12-06 — 2023-11-08",
    metaEn: "6 Dec 2000 — 8 Nov 2023",
  },
  {
    zh: "中国",
    en: "China",
    metaZh: "2023-11-08 起；具体场所未公开确认",
    metaEn: "Since 8 Nov 2023; exact place not publicly confirmed",
  },
];

function text(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

function normalizeVariant(value: string | null): VariantKey {
  return value === "B" || value === "C" ? value : "A";
}

function normalizeSurface(value: string | null): SurfaceKey {
  return SURFACES.some((item) => item.key === value) ? (value as SurfaceKey) : "home";
}

function normalizeScenario(value: string | null): ScenarioKey {
  return SCENARIOS.some((item) => item.key === value) ? (value as ScenarioKey) : "live";
}

export function CrossSurfacePrototype({ locale }: CrossSurfacePrototypeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const variant = normalizeVariant(searchParams.get("variant"));
  const surface = normalizeSurface(searchParams.get("surface"));
  const scenario = normalizeScenario(searchParams.get("state"));
  const reduced = searchParams.get("motion") === "reduce";

  const replaceParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set(key, value);
      router.replace(`${pathname}?${next.toString()}` as Route, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const cycleVariant = useCallback(
    (direction: -1 | 1) => {
      const index = VARIANTS.findIndex((item) => item.key === variant);
      const next = VARIANTS[(index + direction + VARIANTS.length) % VARIANTS.length];
      replaceParam("variant", next.key);
    },
    [replaceParam, variant],
  );

  const changeLocale = useCallback(() => {
    const nextLocale: Locale = locale === "zh" ? "en" : "zh";
    const nextPath = pathname.replace(/^\/(zh|en)(?=\/)/, `/${nextLocale}`);
    router.replace(`${nextPath}?${searchParams.toString()}` as Route, { scroll: false });
  }, [locale, pathname, router, searchParams]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycleVariant(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        cycleVariant(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycleVariant]);

  const variantProps: VariantProps = {
    locale,
    surface,
    scenario,
    onSurfaceChange: (next) => replaceParam("surface", next),
    onLocaleChange: changeLocale,
  };

  return (
    <div className={`${styles.prototypeRoot} ${reduced ? styles.reduceMotion : ""}`}>
      <a className={styles.skipLink} href="#prototype-main">
        {text(locale, "跳到原型内容", "Skip to prototype content")}
      </a>
      <div className={styles.prototypeFlag} aria-label={text(locale, "非生产原型", "Non-production prototype")}>
        <CircleDashed aria-hidden="true" />
        <span>PROTOTYPE 37</span>
      </div>

      {variant === "A" ? <VariantA {...variantProps} /> : null}
      {variant === "B" ? <VariantB {...variantProps} /> : null}
      {variant === "C" ? <VariantC {...variantProps} /> : null}

      <PrototypeDock
        locale={locale}
        variant={variant}
        surface={surface}
        scenario={scenario}
        reduced={reduced}
        onPrevious={() => cycleVariant(-1)}
        onNext={() => cycleVariant(1)}
        onSurface={(next) => replaceParam("surface", next)}
        onScenario={(next) => replaceParam("state", next)}
        onLocale={changeLocale}
        onMotion={() => replaceParam("motion", reduced ? "system" : "reduce")}
      />
    </div>
  );
}

function PrototypeDock({
  locale,
  variant,
  surface,
  scenario,
  reduced,
  onPrevious,
  onNext,
  onSurface,
  onScenario,
  onLocale,
  onMotion,
}: {
  locale: Locale;
  variant: VariantKey;
  surface: SurfaceKey;
  scenario: ScenarioKey;
  reduced: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSurface: (surface: SurfaceKey) => void;
  onScenario: (scenario: ScenarioKey) => void;
  onLocale: () => void;
  onMotion: () => void;
}) {
  const current = VARIANTS.find((item) => item.key === variant) ?? VARIANTS[0];

  return (
    <aside className={styles.prototypeDock} aria-label={text(locale, "原型控制器", "Prototype controls")}>
      <div className={styles.variantSwitcher}>
        <button type="button" onClick={onPrevious} aria-label={text(locale, "上一个设计方向", "Previous design direction")}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <div className={styles.variantReadout} aria-live="polite">
          <strong>{current.key} — {text(locale, current.zh, current.en)}</strong>
          <span>{text(locale, current.noteZh, current.noteEn)}</span>
        </div>
        <button type="button" onClick={onNext} aria-label={text(locale, "下一个设计方向", "Next design direction")}>
          <ArrowRight aria-hidden="true" />
        </button>
      </div>

      <div className={styles.labControls}>
        <div className={styles.surfaceTabs} aria-label={text(locale, "代表性页面", "Representative surfaces")}>
          {SURFACES.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-pressed={surface === item.key}
              onClick={() => onSurface(item.key)}
            >
              {text(locale, item.zh, item.en)}
            </button>
          ))}
        </div>
        <label className={styles.scenarioSelect}>
          <span>{text(locale, "状态", "State")}</span>
          <select value={scenario} onChange={(event) => onScenario(event.target.value as ScenarioKey)}>
            {SCENARIOS.map((item) => (
              <option key={item.key} value={item.key}>{text(locale, item.zh, item.en)}</option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.dockUtility} onClick={onLocale}>
          <Languages aria-hidden="true" />
          {locale === "zh" ? "EN" : "中文"}
        </button>
        <button type="button" className={styles.dockUtility} aria-pressed={reduced} onClick={onMotion}>
          <Sparkles aria-hidden="true" />
          {text(locale, reduced ? "减少动画" : "系统动画" , reduced ? "Reduced" : "System motion")}
        </button>
      </div>
    </aside>
  );
}

function VariantA({ locale, surface, scenario, onSurfaceChange, onLocaleChange }: VariantProps) {
  return (
    <div className={styles.variantA}>
      <header className={styles.aHeader}>
        <button type="button" className={styles.aBrand} onClick={() => onSurfaceChange("home")}>
          <span className={styles.aBrandMark}>PA</span>
          <span><strong>PandaAtlas</strong><small>{text(locale, "大熊猫动态档案馆", "Living giant panda archive")}</small></span>
        </button>
        <nav className={styles.aNav} aria-label={text(locale, "主导航", "Primary navigation")}>
          {SURFACES.slice(1).map((item) => (
            <button key={item.key} type="button" aria-current={surface === item.key ? "page" : undefined} onClick={() => onSurfaceChange(item.key)}>
              {text(locale, item.zh, item.en)}
            </button>
          ))}
        </nav>
        <div className={styles.aHeaderTools}>
          <button type="button" aria-label={text(locale, "搜索档案", "Search records")}><Search aria-hidden="true" /></button>
          <button type="button" onClick={onLocaleChange}><Globe2 aria-hidden="true" />{locale === "zh" ? "EN" : "中"}</button>
          <button type="button" className={styles.mobileOnly} aria-label={text(locale, "打开菜单", "Open menu")}><Menu aria-hidden="true" /></button>
        </div>
      </header>
      <ScenarioFrame locale={locale} surface={surface} scenario={scenario}>
        {surface === "home" ? <AHome locale={locale} /> : null}
        {surface === "atlas" ? <AAtlas locale={locale} /> : null}
        {surface === "profile" ? <AProfile locale={locale} noMedia={scenario === "no-media"} /> : null}
        {surface === "lineage" ? <ALineage locale={locale} /> : null}
        {surface === "map" ? <AMap locale={locale} /> : null}
      </ScenarioFrame>
    </div>
  );
}

function AHome({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.aHome}>
      <section className={styles.aHero}>
        <div className={styles.aHeroCopy}>
          <p className={styles.aKicker}>{text(locale, "一座持续修订的自然史档案馆", "A natural-history archive under continuous revision")}</p>
          <h1>{text(locale, "沿着名字、家族与迁徙，读懂每一份生命档案。", "Follow names, families and journeys through every living record.")}</h1>
          <p>{text(locale, "从可信个体档案进入关系、场所与来源；不确定性和缺失内容始终可见。", "Enter through trusted profiles, then move into relations, places and sources with uncertainty always visible.")}</p>
          <div className={styles.aHeroActions}>
            <button type="button"><Search aria-hidden="true" />{text(locale, "查找一只熊猫", "Find a panda")}</button>
            <button type="button"><BookOpen aria-hidden="true" />{text(locale, "阅读档案方法", "Read the archive method")}</button>
          </div>
        </div>
        <div className={styles.aSpecimen} aria-label={text(locale, "档案示例：美香", "Archive specimen: Mei Xiang")}>
          <div className={styles.aSpecimenBackdrop} aria-hidden="true"><span /><span /><span /></div>
          <div className={styles.aSpecimenTopline}><span>PA — 0001</span><TruthChip kind="confirmed" locale={locale} /></div>
          <div className={styles.aSpecimenName}><strong>{text(locale, "美香", "Mei Xiang")}</strong><span>{locale === "zh" ? "Mei Xiang / Měixiāng" : "美香 / Měixiāng"}</span></div>
          <dl className={styles.aSpecimenFacts}>
            <div><dt>{text(locale, "出生", "Born")}</dt><dd>{text(locale, "1998-07-22", "22 Jul 1998")}</dd></div>
            <div><dt>{text(locale, "最后确认场所", "Last confirmed place")}</dt><dd>{text(locale, "中国 · 国家级", "China · country-level")}</dd></div>
          </dl>
          <p className={styles.aSourceLine}><ShieldCheck aria-hidden="true" />{text(locale, "3 个公开来源 · 最后核实 2026-05-09", "3 public sources · Last verified 9 May 2026")}</p>
        </div>
      </section>
      <section className={styles.aHomeIndex}>
        <article><span>01</span><h2>{text(locale, "从个体开始", "Begin with an individual")}</h2><p>{text(locale, "每个入口都回到一份可追溯、可修订的个体档案。", "Every path returns to a traceable, revisable individual record.")}</p></article>
        <article><span>02</span><h2>{text(locale, "关系不是装饰线", "Relations are not decorative lines")}</h2><p>{text(locale, "图谱和线性列表共同呈现关系状态与来源。", "Graphs and linear lists share the same relation status and sources.")}</p></article>
        <article><span>03</span><h2>{text(locale, "地图不独占事实", "The map never owns the facts")}</h2><p>{text(locale, "空间视图旁始终保留场所、时间和来源列表。", "Place, time and source lists remain available beside spatial views.")}</p></article>
      </section>
    </main>
  );
}

function AAtlas({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.aAtlas}>
      <header className={styles.aPageLead}>
        <p>{text(locale, "公开图鉴 · 发布版本 2026.07.14.3", "Public atlas · release 2026.07.14.3")}</p>
        <h1>{text(locale, "查找个体档案", "Find an individual record")}</h1>
        <label className={styles.aSearchField}><Search aria-hidden="true" /><span className={styles.visuallyHidden}>{text(locale, "搜索名称、拼音或别名", "Search name, pinyin or alias")}</span><input placeholder={text(locale, "名称、拼音、历史拼写或外部标识符", "Name, pinyin, historic spelling or external identifier")} /></label>
      </header>
      <div className={styles.aAtlasLayout}>
        <aside className={styles.aFilterRail}>
          <h2>{text(locale, "缩小范围", "Narrow the set")}</h2>
          <button type="button" aria-pressed="true">{text(locale, "全部公开档案", "All public records")} <span>7</span></button>
          <button type="button">{text(locale, "场所近期核实", "Place recently verified")} <span>3</span></button>
          <button type="button">{text(locale, "含暂定关系", "With provisional relations")} <span>2</span></button>
          <button type="button">{text(locale, "无许可媒体", "No licensed media")} <span>5</span></button>
          <p>{text(locale, "数字仅描述当前发布版本。", "Counts describe this release only.")}</p>
        </aside>
        <section className={styles.aResultList} aria-label={text(locale, "档案结果", "Record results")}>
          <div className={styles.aResultSummary}><strong>{text(locale, "3 份示例档案", "3 sample records")}</strong><span>{text(locale, "按名称排序", "Sorted by name")}</span></div>
          {PANDAS.map((panda, index) => (
            <article key={panda.id} className={styles.aResultRow}>
              <div className={styles.aIndexNumber}>0{index + 1}</div>
              <div className={styles.aMiniPortrait} aria-label={text(locale, "无许可公开媒体", "No licensed public media")}><ImageOff aria-hidden="true" /></div>
              <div className={styles.aResultIdentity}><h2>{text(locale, panda.zh, panda.en)}</h2><p>{locale === "zh" ? panda.en : panda.zh}</p></div>
              <dl><div><dt>{text(locale, "出生", "Born")}</dt><dd>{text(locale, panda.bornZh, panda.bornEn)}</dd></div><div><dt>{text(locale, "当前场所", "Current place")}</dt><dd>{text(locale, panda.placeZh, panda.placeEn)}</dd></div></dl>
              <div className={styles.aResultEvidence}><TruthChip kind="confirmed" locale={locale} /><span>{text(locale, "最后核实 2026-05-10", "Last verified 10 May 2026")}</span><button type="button">{text(locale, "打开档案", "Open profile")}<ChevronRight aria-hidden="true" /></button></div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function AProfile({ locale, noMedia }: { locale: Locale; noMedia: boolean }) {
  return (
    <main id="prototype-main" className={styles.aProfile}>
      <div className={styles.aProfileTitle}>
        <p>{text(locale, "可信个体档案 · PA—0001", "Trusted individual record · PA—0001")}</p>
        <h1>{text(locale, "美香", "Mei Xiang")}</h1>
        <div>{locale === "zh" ? "Mei Xiang · Měixiāng" : "美香 · Měixiāng"}</div>
      </div>
      <div className={styles.aProfileGrid}>
        <article className={styles.aProfileStory}>
          <section className={styles.aProfileIntro}>
            <div className={styles.aProfileMedia}>
              <MediaPlaceholder locale={locale} emphasized={noMedia} />
            </div>
            <div>
              <h2>{text(locale, "档案摘要", "Record summary")}</h2>
              <p>{text(locale, "美香是史密森尼国家动物园大熊猫保育合作历史中的核心个体。当前公开结论确认其已于 2023 年返回中国，但具体场所只确认到国家级。", "Mei Xiang is a central individual in the Smithsonian giant panda conservation partnership. The current public conclusion confirms her 2023 return to China, while the exact place remains confirmed only at country level.")}</p>
              <SourceLink locale={locale} labelZh="摘要依据 2 个公开来源" labelEn="Summary supported by 2 public sources" />
            </div>
          </section>
          <section className={styles.aProfileSection}>
            <h2>{text(locale, "迁徙与居住", "Journey and residency")}</h2>
            <ol className={styles.aTimeline}>
              <li><time>2000-12-06</time><div><strong>{text(locale, "抵达华盛顿", "Arrived in Washington")}</strong><p>{text(locale, "史密森尼国家动物园 · 已完成事件", "Smithsonian’s National Zoo · completed event")}</p><SourceLink locale={locale} labelZh="来源 1" labelEn="1 source" /></div></li>
              <li><time>2023-11-08</time><div><strong>{text(locale, "返回中国", "Returned to China")}</strong><p>{text(locale, "当前只公开确认到国家级", "Currently confirmed at country level only")}</p><SourceLink locale={locale} labelZh="来源 2" labelEn="2 sources" /></div></li>
            </ol>
          </section>
          <section className={styles.aProfileSection}>
            <h2>{text(locale, "修订记录", "Revision record")}</h2>
            <p>{text(locale, "2026.07.14.3：保留国家级场所精度；撤下无许可媒体；更新来源访问状态。", "2026.07.14.3: retained country-level place precision, withdrew unlicensed media and updated source access states.")}</p>
          </section>
        </article>
        <aside className={styles.aRecordRail} aria-label={text(locale, "关键事实与来源", "Key facts and sources")}>
          <div className={styles.aRailHeading}><span>{text(locale, "当前结论", "Current conclusions")}</span><TruthChip kind="confirmed" locale={locale} /></div>
          <FactBlock locale={locale} labelZh="出生日期" labelEn="Birth date" valueZh="1998 年 7 月 22 日" valueEn="22 July 1998" detailZh="稳定事实 · 最后核实 2026-05-09" detailEn="Stable fact · Last verified 9 May 2026" />
          <FactBlock locale={locale} labelZh="性别" labelEn="Sex" valueZh="雌性" valueEn="Female" detailZh="已确认 · 1 个来源" detailEn="Confirmed · 1 source" />
          <FactBlock locale={locale} labelZh="当前场所" labelEn="Current place" valueZh="中国" valueEn="China" detailZh="国家级精度 · 最后核实 2026-05-09" detailEn="Country-level precision · Last verified 9 May 2026" />
          <div className={styles.aRailSources}><h2>{text(locale, "公开来源", "Public sources")}</h2><SourceCard locale={locale} publisher="Smithsonian" title="Giant Panda History" state="accessible" /><SourceCard locale={locale} publisher="Smithsonian" title="2020 Cooperative Agreement" state="archived" /></div>
        </aside>
      </div>
    </main>
  );
}

function ALineage({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.aLineage}>
      <header className={styles.aToolHeader}><div><p>{text(locale, "家族探索器", "Lineage explorer")}</p><h1>{text(locale, "以小奇迹为焦点", "Focused on Xiao Qi Ji")}</h1></div><div><TruthChip kind="confirmed" locale={locale} /><span>{text(locale, "深度 2 · 3 条公开关系", "Depth 2 · 3 public relations")}</span></div></header>
      <div className={styles.aLineageGrid}>
        <section className={styles.aGraphPanel} aria-label={text(locale, "关系图", "Relationship graph")}>
          <div className={styles.aGraphEdgeOne} aria-hidden="true" />
          <div className={styles.aGraphEdgeTwo} aria-hidden="true" />
          <button type="button" className={`${styles.aGraphNode} ${styles.aGraphMother}`}><span>{text(locale, "母亲", "Mother")}</span><strong>{text(locale, "美香", "Mei Xiang")}</strong><small>{text(locale, "已确认", "Confirmed")}</small></button>
          <button type="button" className={`${styles.aGraphNode} ${styles.aGraphFather}`}><span>{text(locale, "父亲", "Father")}</span><strong>{text(locale, "添添", "Tian Tian")}</strong><small>{text(locale, "已确认", "Confirmed")}</small></button>
          <button type="button" className={`${styles.aGraphNode} ${styles.aGraphFocus}`}><span>{text(locale, "焦点", "Focus")}</span><strong>{text(locale, "小奇迹", "Xiao Qi Ji")}</strong><small>{text(locale, "打开档案", "Open profile")}</small></button>
        </section>
        <aside className={styles.aGraphNotes}>
          <h2>{text(locale, "图形说明", "Graph notes")}</h2>
          <p>{text(locale, "线条仅帮助理解位置；关系状态与来源以右侧列表为准。", "Lines assist spatial understanding; relation status and sources remain authoritative in the list.")}</p>
          <SourceLink locale={locale} labelZh="查看关系方法" labelEn="Read the relation method" />
        </aside>
      </div>
      <RelationList locale={locale} className={styles.aRelationList} />
    </main>
  );
}

function AMap({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.aMap}>
      <header className={styles.aToolHeader}><div><p>{text(locale, "足迹与分布", "Footprint and distribution")}</p><h1>{text(locale, "美香的公开足迹", "Mei Xiang’s public footprint")}</h1></div><div><TruthChip kind="confirmed" locale={locale} /><span>{text(locale, "快照 2026-07-14", "Snapshot 14 Jul 2026")}</span></div></header>
      <div className={styles.aMapGrid}>
        <section className={styles.aMapCanvas} aria-label={text(locale, "示意地图；下方列表提供等价内容", "Illustrative map; equivalent content is available in the list below")}>
          <div className={styles.aContour} aria-hidden="true" />
          <button type="button" className={`${styles.aMarker} ${styles.aMarkerWest}`}><span>1</span><small>{text(locale, "华盛顿", "Washington")}</small></button>
          <button type="button" className={`${styles.aMarker} ${styles.aMarkerEast}`}><span>2</span><small>{text(locale, "中国", "China")}</small></button>
          <div className={styles.aMapRoute} aria-hidden="true" />
          <div className={styles.aMapAttribution}>Prototype geometry · Basemap not loaded</div>
        </section>
        <aside className={styles.aMapSide}><h2>{text(locale, "结构化场所列表", "Structured place list")}</h2><p>{text(locale, "地图不是唯一入口；所有场所、日期和精度都可在此读取。", "The map is not the only entry; every place, date and precision remains readable here.")}</p><LocationList locale={locale} /></aside>
      </div>
    </main>
  );
}

function VariantB({ locale, surface, scenario, onSurfaceChange, onLocaleChange }: VariantProps) {
  return (
    <div className={styles.variantB}>
      <header className={styles.bHeader}>
        <button type="button" className={styles.bBrand} onClick={() => onSurfaceChange("home")}><Database aria-hidden="true" /><strong>PANDAATLAS</strong><span>PUBLIC RELEASE / 2026.07.14.3</span></button>
        <nav className={styles.bNav} aria-label={text(locale, "主导航", "Primary navigation")}>
          {SURFACES.map((item, index) => <button type="button" key={item.key} onClick={() => onSurfaceChange(item.key)} aria-current={surface === item.key ? "page" : undefined}><span>0{index + 1}</span>{text(locale, item.zh, item.en)}</button>)}
        </nav>
        <button type="button" className={styles.bLocale} onClick={onLocaleChange}>{locale === "zh" ? "ENGLISH" : "中文"}</button>
      </header>
      <ScenarioFrame locale={locale} surface={surface} scenario={scenario}>
        {surface === "home" ? <BHome locale={locale} /> : null}
        {surface === "atlas" ? <BAtlas locale={locale} /> : null}
        {surface === "profile" ? <BProfile locale={locale} /> : null}
        {surface === "lineage" ? <BLineage locale={locale} /> : null}
        {surface === "map" ? <BMap locale={locale} /> : null}
      </ScenarioFrame>
    </div>
  );
}

function BHome({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.bHome}>
      <section className={styles.bManifest}>
        <div className={styles.bManifestCode}>PUBLIC ARCHIVE / DATASET 2026.07.14.3 / SCHEMA 1.0.0</div>
        <h1>{text(locale, "把证据放在叙事之前。", "Put evidence before narrative.")}</h1>
        <p>{text(locale, "PandaAtlas 将个体、关系、场所和修订组织成一套可追溯的公开台账。", "PandaAtlas organizes individuals, relations, places and revisions as a traceable public ledger.")}</p>
        <button type="button"><FileSearch aria-hidden="true" />{text(locale, "查询公开档案", "Query public records")}</button>
      </section>
      <section className={styles.bReleaseStats} aria-label={text(locale, "当前发布版本范围", "Current release coverage")}>
        <div><strong>7</strong><span>{text(locale, "公开个体档案", "public individual records")}</span></div>
        <div><strong>9</strong><span>{text(locale, "已确认亲缘结论", "confirmed parentage conclusions")}</span></div>
        <div><strong>3</strong><span>{text(locale, "暂定亲缘结论", "provisional parentage conclusions")}</span></div>
        <div><strong>2026-07-14</strong><span>{text(locale, "发布快照", "release snapshot")}</span></div>
      </section>
      <section className={styles.bIndexTable}>
        <div className={styles.bTableHeader}><span>ID</span><span>{text(locale, "入口", "ENTRY")}</span><span>{text(locale, "范围", "COVERAGE")}</span><span>{text(locale, "发布状态", "DELIVERY")}</span><span>{text(locale, "操作", "ACTION")}</span></div>
        {[
          ["IDX-01", text(locale, "个体图鉴", "Individual atlas"), text(locale, "7 份公开档案", "7 public records")],
          ["IDX-02", text(locale, "家族关系", "Lineage relations"), text(locale, "12 条公开结论", "12 public conclusions")],
          ["IDX-03", text(locale, "场所与足迹", "Places and footprint"), text(locale, "当前快照", "current snapshot")],
        ].map((row) => <div className={styles.bTableRow} key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><span>{row[2]}</span><TruthChip kind="live" locale={locale} /><button type="button">OPEN <ArrowRight aria-hidden="true" /></button></div>)}
      </section>
    </main>
  );
}

function BAtlas({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.bAtlas}>
      <aside className={styles.bFilterPanel}>
        <div><span>QUERY / PUBLIC RECORDS</span><h1>{text(locale, "个体图鉴", "Individual atlas")}</h1></div>
        <label><span>{text(locale, "名称或标识符", "Name or identifier")}</span><div><Search aria-hidden="true" /><input placeholder={text(locale, "输入查询", "Enter query")} /></div></label>
        <fieldset><legend>{text(locale, "结论状态", "Conclusion status")}</legend><label><input type="checkbox" defaultChecked />{text(locale, "已确认", "Confirmed")}</label><label><input type="checkbox" />{text(locale, "含暂定关系", "Provisional relations")}</label></fieldset>
        <fieldset><legend>{text(locale, "媒体状态", "Media status")}</legend><label><input type="checkbox" />{text(locale, "已许可", "Licensed")}</label><label><input type="checkbox" defaultChecked />{text(locale, "无许可媒体", "No licensed media")}</label></fieldset>
        <p>{text(locale, "所有计数仅针对发布版本 2026.07.14.3。", "All counts apply only to release 2026.07.14.3.")}</p>
      </aside>
      <section className={styles.bDataTable}>
        <div className={styles.bDataToolbar}><strong>RESULT SET / 3 SAMPLE ROWS</strong><span>{text(locale, "完整范围：是", "Coverage complete: yes")}</span><button type="button">CSV</button></div>
        <div className={styles.bDataHead}><span>ID</span><span>{text(locale, "主名称", "PRIMARY NAME")}</span><span>{text(locale, "出生", "BORN")}</span><span>{text(locale, "当前场所", "CURRENT PLACE")}</span><span>{text(locale, "结论", "CONCLUSION")}</span><span>{text(locale, "最后核实", "LAST VERIFIED")}</span></div>
        {PANDAS.map((panda, index) => <article key={panda.id} className={styles.bDataRow}><span>PA-{String(index + 1).padStart(4, "0")}</span><div><strong>{text(locale, panda.zh, panda.en)}</strong><small>{locale === "zh" ? panda.en : panda.zh}</small></div><span>{text(locale, panda.bornZh, panda.bornEn)}</span><span>{text(locale, panda.placeZh, panda.placeEn)}</span><TruthChip kind="confirmed" locale={locale} /><span>2026-05-{index === 2 ? "10" : "09"}</span><button type="button" aria-label={text(locale, `打开${panda.zh}档案`, `Open ${panda.en} profile`)}><ArrowRight aria-hidden="true" /></button></article>)}
      </section>
    </main>
  );
}

function BProfile({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.bProfile}>
      <header className={styles.bDossierHeader}>
        <div><span>INDIVIDUAL / PA-0001</span><h1>{text(locale, "美香", "Mei Xiang")}</h1><p>{locale === "zh" ? "MEI XIANG / MĚIXIĀNG" : "美香 / MĚIXIĀNG"}</p></div>
        <div className={styles.bDossierState}><TruthChip kind="confirmed" locale={locale} /><span>RELEASE 2026.07.14.3</span><span>SCHEMA 1.0.0</span></div>
      </header>
      <div className={styles.bDossierGrid}>
        <section className={styles.bFactTable}>
          <h2>01 / {text(locale, "当前结论", "CURRENT CONCLUSIONS")}</h2>
          <FactTableRow locale={locale} field="birth_date" labelZh="出生日期" labelEn="Birth date" valueZh="1998-07-22 · 日级精度" valueEn="1998-07-22 · day precision" status="confirmed" />
          <FactTableRow locale={locale} field="sex" labelZh="性别" labelEn="Sex" valueZh="雌性" valueEn="Female" status="confirmed" />
          <FactTableRow locale={locale} field="current_place" labelZh="当前场所" labelEn="Current place" valueZh="中国 · 国家级精度" valueEn="China · country-level precision" status="confirmed" />
        </section>
        <section className={styles.bMediaCell}><h2>02 / MEDIA</h2><MediaPlaceholder locale={locale} emphasized /></section>
        <section className={styles.bSourceTable}><h2>03 / {text(locale, "公开来源", "PUBLIC SOURCES")}</h2><SourceCard locale={locale} publisher="Smithsonian" title="Giant Panda History" state="accessible" /><SourceCard locale={locale} publisher="Smithsonian" title="2020 Cooperative Agreement" state="archived" /></section>
        <section className={styles.bRevisionCell}><h2>04 / REVISION</h2><strong>2026.07.14.3</strong><p>{text(locale, "保留国家级场所精度；撤下无许可媒体；更新来源访问状态。", "Retained country-level place precision; withdrew unlicensed media; updated source access states.")}</p></section>
      </div>
    </main>
  );
}

function BLineage({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.bLineage}>
      <header className={styles.bToolTitle}><div><span>RELATION QUERY / FOCUS PA-0003</span><h1>{text(locale, "家族关系台账", "Lineage relation ledger")}</h1></div><div><button type="button">DEPTH 02</button><button type="button">STATUS ALL</button></div></header>
      <section className={styles.bMatrix} aria-label={text(locale, "关系矩阵", "Relation matrix")}>
        <div className={styles.bMatrixHead}><span>SUBJECT</span><span>ROLE</span><span>OBJECT</span><span>STATUS</span><span>SOURCES</span></div>
        {RELATIONS.map((item, index) => <div className={styles.bMatrixRow} key={`${item.roleEn}-${item.en}`}><strong>{index === 2 ? text(locale, "宝宝", "Bao Bao") : text(locale, "小奇迹", "Xiao Qi Ji")}</strong><span>{text(locale, item.roleZh, item.roleEn)}</span><strong>{text(locale, item.zh, item.en)}</strong><TruthChip kind={item.state as "confirmed" | "provisional"} locale={locale} /><button type="button">SRC-{index + 1}<ExternalLink aria-hidden="true" /></button></div>)}
      </section>
      <section className={styles.bGraphAndList}>
        <div className={styles.bCompactGraph} aria-label={text(locale, "紧凑关系图", "Compact relationship graph")}><button type="button">PA-0001<br /><strong>{text(locale, "美香", "Mei Xiang")}</strong></button><span aria-hidden="true" /><button type="button">PA-0003<br /><strong>{text(locale, "小奇迹", "Xiao Qi Ji")}</strong></button><span aria-hidden="true" /><button type="button">PA-0007<br /><strong>{text(locale, "宝力", "Bao Li")}</strong></button></div>
        <RelationList locale={locale} className={styles.bLinearRelations} />
      </section>
    </main>
  );
}

function BMap({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.bMap}>
      <header className={styles.bToolTitle}><div><span>SPATIAL QUERY / SNAPSHOT 2026-07-14</span><h1>{text(locale, "场所与足迹台账", "Place and footprint ledger")}</h1></div><div><button type="button">MODE / FOOTPRINT</button><button type="button">ENTITY / PA-0001</button></div></header>
      <div className={styles.bMapLayout}>
        <section className={styles.bMapWindow} aria-label={text(locale, "地图视图；右侧表格为等价内容", "Map view; the adjacent table is equivalent content")}><div className={styles.bGridMap} aria-hidden="true" /><button type="button" className={styles.bPointOne}>01</button><button type="button" className={styles.bPointTwo}>02</button><div className={styles.bMapMeta}>BBOX / PROTOTYPE<br />BASEMAP / NOT LOADED<br />ATTRIBUTION / REQUIRED</div></section>
        <section className={styles.bLocationTable}><div className={styles.bLocationHead}><span>ID</span><span>{text(locale, "场所", "PLACE")}</span><span>{text(locale, "区间", "INTERVAL")}</span><span>{text(locale, "精度", "PRECISION")}</span><span>STATUS</span></div>{LOCATIONS.map((item, index) => <div className={styles.bLocationRow} key={item.en}><span>L-{index + 1}</span><strong>{text(locale, item.zh, item.en)}</strong><span>{text(locale, item.metaZh, item.metaEn)}</span><span>{index === 0 ? text(locale, "场所级", "place-level") : text(locale, "国家级", "country-level")}</span><TruthChip kind="confirmed" locale={locale} /></div>)}</section>
      </div>
    </main>
  );
}

function VariantC({ locale, surface, scenario, onSurfaceChange, onLocaleChange }: VariantProps) {
  return (
    <div className={styles.variantC}>
      <aside className={styles.cRail}>
        <button type="button" className={styles.cLogo} onClick={() => onSurfaceChange("home")}><span>PA</span><strong>PandaAtlas</strong></button>
        <nav aria-label={text(locale, "探索路径", "Exploration trail")}>
          {SURFACES.map((item) => {
            const Icon = item.key === "home" ? Sparkles : item.key === "atlas" ? Search : item.key === "profile" ? BookOpen : item.key === "lineage" ? Network : MapPinned;
            return <button type="button" key={item.key} onClick={() => onSurfaceChange(item.key)} aria-current={surface === item.key ? "page" : undefined}><Icon aria-hidden="true" /><span>{text(locale, item.zh, item.en)}</span></button>;
          })}
        </nav>
        <button type="button" className={styles.cLocale} onClick={onLocaleChange}><Languages aria-hidden="true" />{locale === "zh" ? "EN" : "中文"}</button>
      </aside>
      <ScenarioFrame locale={locale} surface={surface} scenario={scenario}>
        {surface === "home" ? <CHome locale={locale} /> : null}
        {surface === "atlas" ? <CAtlas locale={locale} /> : null}
        {surface === "profile" ? <CProfile locale={locale} /> : null}
        {surface === "lineage" ? <CLineage locale={locale} /> : null}
        {surface === "map" ? <CMap locale={locale} /> : null}
      </ScenarioFrame>
    </div>
  );
}

function CHome({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.cHome}>
      <section className={styles.cHomeCanvas}>
        <div className={styles.cRouteLines} aria-hidden="true"><span /><span /><span /></div>
        <div className={styles.cHomeCopy}>
          <p>{text(locale, "从一只熊猫出发", "Start with one panda")}</p>
          <h1>{text(locale, "每份档案，都是通向家族、场所与来源的一条路径。", "Every record opens a trail into family, place and source.")}</h1>
          <button type="button"><Search aria-hidden="true" />{text(locale, "开始探索", "Begin exploring")}</button>
        </div>
        <button type="button" className={`${styles.cOrb} ${styles.cOrbPrimary}`}><span>PA-0001</span><strong>{text(locale, "美香", "Mei Xiang")}</strong><small>{text(locale, "3 个来源 · 已确认", "3 sources · confirmed")}</small></button>
        <button type="button" className={`${styles.cOrb} ${styles.cOrbRelation}`}><GitBranch aria-hidden="true" /><strong>{text(locale, "家族", "Lineage")}</strong><small>{text(locale, "12 条公开关系", "12 public relations")}</small></button>
        <button type="button" className={`${styles.cOrb} ${styles.cOrbPlace}`}><MapPinned aria-hidden="true" /><strong>{text(locale, "足迹", "Footprint")}</strong><small>{text(locale, "2 个公开场所", "2 public places")}</small></button>
        <button type="button" className={`${styles.cOrb} ${styles.cOrbSource}`}><ShieldCheck aria-hidden="true" /><strong>{text(locale, "来源", "Sources")}</strong><small>{text(locale, "最后核实 2026-05-09", "Last verified 9 May 2026")}</small></button>
      </section>
      <section className={styles.cHomeBottom}><div><span>{text(locale, "当前发布版本", "Current release")}</span><strong>2026.07.14.3</strong></div><p>{text(locale, "路径可以被探索，但每个节点仍保留独立状态、精度和来源。", "Trails invite exploration while every node retains independent status, precision and sources.")}</p></section>
    </main>
  );
}

function CAtlas({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.cAtlas}>
      <header className={styles.cFloatingSearch}><div><p>{text(locale, "图鉴路径", "Atlas trail")}</p><h1>{text(locale, "你想从谁开始？", "Who do you want to start with?")}</h1></div><label><Search aria-hidden="true" /><span className={styles.visuallyHidden}>{text(locale, "搜索个体", "Search individuals")}</span><input placeholder={text(locale, "名称、拼音或别名", "Name, pinyin or alias")} /></label></header>
      <section className={styles.cAtlasTrail} aria-label={text(locale, "示例搜索结果", "Sample search results")}>
        {PANDAS.map((panda, index) => <article key={panda.id} className={styles.cTrailRecord}><div className={styles.cTrailDot}>{index + 1}</div><div className={styles.cTrailMedia}><ImageOff aria-hidden="true" /></div><div className={styles.cTrailText}><span>PA-000{index + 1}</span><h2>{text(locale, panda.zh, panda.en)}</h2><p>{locale === "zh" ? panda.en : panda.zh}</p></div><div className={styles.cTrailFacts}><span>{text(locale, panda.placeZh, panda.placeEn)}</span><TruthChip kind="confirmed" locale={locale} /><small>{text(locale, "最后核实 2026-05-10", "Last verified 10 May 2026")}</small></div><button type="button">{text(locale, "沿此档案探索", "Follow this record")}<ArrowRight aria-hidden="true" /></button></article>)}
      </section>
    </main>
  );
}

function CProfile({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.cProfile}>
      <section className={styles.cIdentityHub}>
        <div className={styles.cHubMedia}><MediaPlaceholder locale={locale} /></div>
        <div className={styles.cHubTitle}><span>PA-0001 / {text(locale, "可信档案", "TRUSTED RECORD")}</span><h1>{text(locale, "美香", "Mei Xiang")}</h1><p>{locale === "zh" ? "Mei Xiang · Měixiāng" : "美香 · Měixiāng"}</p><TruthChip kind="confirmed" locale={locale} /></div>
        <div className={`${styles.cFactOrbit} ${styles.cOrbitOne}`}><span>{text(locale, "出生", "Born")}</span><strong>{text(locale, "1998-07-22", "22 Jul 1998")}</strong><small>{text(locale, "稳定事实", "Stable fact")}</small></div>
        <div className={`${styles.cFactOrbit} ${styles.cOrbitTwo}`}><span>{text(locale, "当前场所", "Current place")}</span><strong>{text(locale, "中国", "China")}</strong><small>{text(locale, "国家级精度", "Country-level precision")}</small></div>
        <div className={`${styles.cFactOrbit} ${styles.cOrbitThree}`}><span>{text(locale, "最后核实", "Last verified")}</span><strong>2026-05-09</strong><small>{text(locale, "3 个公开来源", "3 public sources")}</small></div>
      </section>
      <section className={styles.cProfileTrails}>
        <article><GitBranch aria-hidden="true" /><div><h2>{text(locale, "进入家族路径", "Enter the family trail")}</h2><p>{text(locale, "查看 6 条当前范围关系；其中 1 条为暂定。", "View 6 relations in the current scope; 1 is provisional.")}</p></div><button type="button"><ArrowRight aria-hidden="true" /></button></article>
        <article><MapPinned aria-hidden="true" /><div><h2>{text(locale, "进入足迹路径", "Enter the footprint trail")}</h2><p>{text(locale, "查看 2 个公开居住区间和场所精度。", "View 2 public residency intervals and their precision.")}</p></div><button type="button"><ArrowRight aria-hidden="true" /></button></article>
        <article><ShieldCheck aria-hidden="true" /><div><h2>{text(locale, "进入来源路径", "Enter the source trail")}</h2><p>{text(locale, "逐项查看结论、来源访问状态和修订。", "Trace conclusions, source access states and revisions item by item.")}</p></div><button type="button"><ArrowRight aria-hidden="true" /></button></article>
      </section>
    </main>
  );
}

function CLineage({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.cLineage}>
      <header className={styles.cToolOverlay}><div><span>{text(locale, "路径：档案 / 家族", "Trail: profile / lineage")}</span><h1>{text(locale, "小奇迹的家族路径", "Xiao Qi Ji’s family trail")}</h1></div><button type="button">{text(locale, "深度 2", "Depth 2")}</button></header>
      <section className={styles.cNetworkCanvas} aria-label={text(locale, "关系网络；下方列表提供等价内容", "Relation network; equivalent content is available below")}>
        <div className={styles.cNetworkLineOne} aria-hidden="true" /><div className={styles.cNetworkLineTwo} aria-hidden="true" /><div className={styles.cNetworkLineThree} aria-hidden="true" />
        <button type="button" className={`${styles.cNetworkNode} ${styles.cNodeCenter}`}><strong>{text(locale, "小奇迹", "Xiao Qi Ji")}</strong><span>{text(locale, "焦点", "Focus")}</span></button>
        <button type="button" className={`${styles.cNetworkNode} ${styles.cNodeTop}`}><strong>{text(locale, "美香", "Mei Xiang")}</strong><span>{text(locale, "母亲 · 已确认", "Mother · confirmed")}</span></button>
        <button type="button" className={`${styles.cNetworkNode} ${styles.cNodeLeft}`}><strong>{text(locale, "添添", "Tian Tian")}</strong><span>{text(locale, "父亲 · 已确认", "Father · confirmed")}</span></button>
        <button type="button" className={`${styles.cNetworkNode} ${styles.cNodeRight}`}><strong>{text(locale, "宝力", "Bao Li")}</strong><span>{text(locale, "外甥 · 暂定路径", "Nephew · provisional trail")}</span></button>
      </section>
      <RelationList locale={locale} className={styles.cRelationDrawer} />
    </main>
  );
}

function CMap({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.cMap}>
      <header className={styles.cToolOverlay}><div><span>{text(locale, "路径：档案 / 足迹", "Trail: profile / footprint")}</span><h1>{text(locale, "美香的公开足迹", "Mei Xiang’s public footprint")}</h1></div><TruthChip kind="live" locale={locale} /></header>
      <section className={styles.cMapCanvas} aria-label={text(locale, "足迹地图；右侧抽屉提供等价列表", "Footprint map; the adjacent drawer provides an equivalent list")}>
        <div className={styles.cMapTexture} aria-hidden="true" />
        <div className={styles.cFlightPath} aria-hidden="true" />
        <button type="button" className={`${styles.cMapNode} ${styles.cMapNodeOne}`}><span>01</span><strong>{text(locale, "华盛顿", "Washington")}</strong></button>
        <button type="button" className={`${styles.cMapNode} ${styles.cMapNodeTwo}`}><span>02</span><strong>{text(locale, "中国", "China")}</strong></button>
        <div className={styles.cAttribution}>Prototype map · real provider attribution would remain visible here</div>
      </section>
      <aside className={styles.cMapDrawer}><div><span>{text(locale, "结构化足迹", "Structured footprint")}</span><strong>{text(locale, "2 个公开居住区间", "2 public residency intervals")}</strong></div><LocationList locale={locale} /></aside>
    </main>
  );
}

function ScenarioFrame({ locale, surface, scenario, children }: { locale: Locale; surface: SurfaceKey; scenario: ScenarioKey; children: ReactNode }) {
  if (scenario === "loading") return <StateOnly locale={locale} kind="loading" surface={surface} />;
  if (scenario === "empty") return <StateOnly locale={locale} kind="empty" surface={surface} />;
  if (scenario === "error") {
    if (surface === "map") return <MapErrorFallback locale={locale} />;
    if (surface === "lineage") return <LineageErrorFallback locale={locale} />;
    return <StateOnly locale={locale} kind="error" surface={surface} />;
  }

  return (
    <>
      {scenario === "cached" ? <DeliveryBanner locale={locale} kind="cached" /> : null}
      {scenario === "partial" ? <DeliveryBanner locale={locale} kind="partial" /> : null}
      {scenario === "no-media" ? <DeliveryBanner locale={locale} kind="no-media" /> : null}
      {children}
    </>
  );
}

function StateOnly({ locale, kind, surface }: { locale: Locale; kind: "loading" | "empty" | "error"; surface: SurfaceKey }) {
  const surfaceLabel = SURFACES.find((item) => item.key === surface) ?? SURFACES[0];
  if (kind === "loading") {
    return (
      <main id="prototype-main" className={styles.statePage} aria-busy="true">
        <div className={styles.stateHeading}><LoaderCircle className={styles.spin} aria-hidden="true" /><div><span>{text(locale, "正在加载", "Loading")}</span><h1>{text(locale, `正在加载${surfaceLabel.zh}`, `Loading ${surfaceLabel.en.toLowerCase()}`)}</h1></div></div>
        <p>{text(locale, "页面标题和导航保持可用；占位结构不伪装成真实档案。", "The page title and navigation remain available; placeholders do not impersonate real records.")}</p>
        <div className={styles.skeletonSet} aria-hidden="true"><span /><span /><span /><span /></div>
      </main>
    );
  }
  if (kind === "empty") {
    return (
      <main id="prototype-main" className={styles.statePage}>
        <FileSearch aria-hidden="true" />
        <span>{text(locale, "查询成功 · 0 个匹配项", "Query succeeded · 0 matches")}</span>
        <h1>{text(locale, "当前查询和筛选下没有匹配档案。", "No records match the current query and filters.")}</h1>
        <p>{text(locale, "这不表示现实中不存在相关记录，也不表示加载失败。", "This does not mean relevant real-world records do not exist, and it is not a loading failure.")}</p>
        <div><button type="button">{text(locale, "清除筛选", "Clear filters")}</button><button type="button">{text(locale, "返回完整图鉴", "Return to full atlas")}</button></div>
      </main>
    );
  }
  return (
    <main id="prototype-main" className={styles.statePage} role="alert">
      <AlertTriangle aria-hidden="true" />
      <span>{text(locale, "当前操作未完成", "The current action did not complete")}</span>
      <h1>{text(locale, `无法安全加载${surfaceLabel.zh}内容`, `Unable to safely load ${surfaceLabel.en.toLowerCase()} content`)}</h1>
      <p>{text(locale, "没有可验证的正式发布缓存，因此不会使用演示 fixture 伪装成功页面。", "No verifiable published cache is available, so demo fixtures will not be used to imitate a successful page.")}</p>
      <div><button type="button">{text(locale, "重试", "Retry")}</button><button type="button">{text(locale, "返回图鉴", "Return to atlas")}</button></div>
    </main>
  );
}

function DeliveryBanner({ locale, kind }: { locale: Locale; kind: "cached" | "partial" | "no-media" }) {
  const content = kind === "cached"
    ? {
        titleZh: "正在显示已发布缓存版本",
        titleEn: "Showing a published cached release",
        bodyZh: "实时服务暂不可用。事实来自版本 2026.07.14.3；来源链接和最新视口查询可能无法刷新。",
        bodyEn: "The live service is unavailable. Facts come from release 2026.07.14.3; source links and fresh viewport queries may not refresh.",
      }
    : kind === "partial"
      ? {
          titleZh: "当前结果不完整",
          titleEn: "The current result is partial",
          bodyZh: "已显示当前可验证范围；部分关系或场所未返回，计数仅针对当前可见集合。",
          bodyEn: "The verifiable portion is shown; some relations or places were not returned, and counts apply only to the visible set.",
        }
      : {
          titleZh: "当前没有获准公开的个体媒体",
          titleEn: "No individual media is cleared for public use",
          bodyZh: "档案事实和来源仍然可读；不会使用其他熊猫照片填补视觉空间。",
          bodyEn: "Record facts and sources remain readable; imagery of another panda will not be substituted.",
        };
  const Icon = kind === "cached" ? Clock3 : kind === "partial" ? AlertTriangle : ImageOff;
  return <div className={styles.deliveryBanner} role="status"><Icon aria-hidden="true" /><div><strong>{text(locale, content.titleZh, content.titleEn)}</strong><p>{text(locale, content.bodyZh, content.bodyEn)}</p></div><span>{kind.toUpperCase()}</span></div>;
}

function MapErrorFallback({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.fallbackPage}>
      <header><AlertTriangle aria-hidden="true" /><div><span>{text(locale, "地图模块不可用", "Map module unavailable")}</span><h1>{text(locale, "场所与足迹仍可通过结构化列表浏览", "Places and footprint remain available as a structured list")}</h1><p>{text(locale, "当前模式、筛选、快照日期和场所精度均被保留。", "The current mode, filters, snapshot date and place precision are preserved.")}</p></div><button type="button">{text(locale, "重试地图", "Retry map")}</button></header>
      <LocationList locale={locale} />
      <p className={styles.fallbackMeta}>{text(locale, "发布版本 2026.07.14.3 · 快照 2026-07-14 · 地图供应商未加载", "Release 2026.07.14.3 · snapshot 14 Jul 2026 · map provider not loaded")}</p>
    </main>
  );
}

function LineageErrorFallback({ locale }: { locale: Locale }) {
  return (
    <main id="prototype-main" className={styles.fallbackPage}>
      <header><AlertTriangle aria-hidden="true" /><div><span>{text(locale, "谱系图形不可用", "Lineage graph unavailable")}</span><h1>{text(locale, "已发布关系仍可按顺序阅读", "Published relations remain readable in order")}</h1><p>{text(locale, "焦点、深度、关系状态和来源没有因图形失败而消失。", "Focus, depth, relation status and sources do not disappear when the graph fails.")}</p></div><button type="button">{text(locale, "重试图形", "Retry graph")}</button></header>
      <RelationList locale={locale} />
    </main>
  );
}

function TruthChip({ kind, locale }: { kind: "confirmed" | "provisional" | "live"; locale: Locale }) {
  const label = kind === "confirmed" ? text(locale, "已确认", "Confirmed") : kind === "provisional" ? text(locale, "暂定", "Provisional") : text(locale, "当前发布", "Live release");
  const Icon = kind === "provisional" ? AlertTriangle : CheckCircle2;
  return <span className={`${styles.truthChip} ${styles[`truth${kind}`]}`}><Icon aria-hidden="true" />{label}</span>;
}

function SourceLink({ locale, labelZh, labelEn }: { locale: Locale; labelZh: string; labelEn: string }) {
  return <button type="button" className={styles.sourceLink}><ShieldCheck aria-hidden="true" />{text(locale, labelZh, labelEn)}<ExternalLink aria-hidden="true" /></button>;
}

function MediaPlaceholder({ locale, emphasized = false }: { locale: Locale; emphasized?: boolean }) {
  return <div className={`${styles.mediaPlaceholder} ${emphasized ? styles.mediaEmphasized : ""}`}><ImageOff aria-hidden="true" /><strong>{text(locale, "无已许可公开媒体", "No licensed public media")}</strong><p>{text(locale, "来源页面可能含有媒体，但 PandaAtlas 未复制或重新授权。", "A source page may contain media, but PandaAtlas has not copied or relicensed it.")}</p><button type="button">{text(locale, "查看来源说明", "Read source note")}</button></div>;
}

function FactBlock({ locale, labelZh, labelEn, valueZh, valueEn, detailZh, detailEn }: { locale: Locale; labelZh: string; labelEn: string; valueZh: string; valueEn: string; detailZh: string; detailEn: string }) {
  return <div className={styles.factBlock}><span>{text(locale, labelZh, labelEn)}</span><strong>{text(locale, valueZh, valueEn)}</strong><small>{text(locale, detailZh, detailEn)}</small><SourceLink locale={locale} labelZh="来源" labelEn="Source" /></div>;
}

function FactTableRow({ locale, field, labelZh, labelEn, valueZh, valueEn, status }: { locale: Locale; field: string; labelZh: string; labelEn: string; valueZh: string; valueEn: string; status: "confirmed" | "provisional" }) {
  return <div className={styles.factTableRow}><code>{field}</code><div><span>{text(locale, labelZh, labelEn)}</span><strong>{text(locale, valueZh, valueEn)}</strong></div><TruthChip kind={status} locale={locale} /><span>2026-05-09</span><button type="button">SRC <ExternalLink aria-hidden="true" /></button></div>;
}

function SourceCard({ locale, publisher, title, state }: { locale: Locale; publisher: string; title: string; state: "accessible" | "archived" }) {
  return <article className={styles.sourceCard}><div><span>{publisher}</span><strong>{title}</strong></div><p>{state === "accessible" ? text(locale, "可访问 · 最后核实 2026-05-09", "Accessible · Last verified 9 May 2026") : text(locale, "已归档 · 最后核实 2026-05-09", "Archived · Last verified 9 May 2026")}</p><button type="button" aria-label={text(locale, `打开来源：${title}`, `Open source: ${title}`)}><ExternalLink aria-hidden="true" /></button></article>;
}

function RelationList({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <section className={`${styles.relationList} ${className}`} aria-label={text(locale, "结构化关系列表", "Structured relationship list")}>
      <header><div><ListTree aria-hidden="true" /><h2>{text(locale, "结构化关系列表", "Structured relationship list")}</h2></div><span>{text(locale, "图形的完整等价入口", "Complete equivalent to the graph")}</span></header>
      <ol>{RELATIONS.map((item, index) => <li key={`${item.roleEn}-${item.en}`}><span>0{index + 1}</span><div><strong>{text(locale, item.roleZh, item.roleEn)}：{text(locale, item.zh, item.en)}</strong><p>{item.state === "confirmed" ? text(locale, "已确认关系 · 1 个公开来源", "Confirmed relation · 1 public source") : text(locale, "暂定关系 · 不在其他页面简化为已确认", "Provisional relation · not simplified to confirmed elsewhere")}</p></div><TruthChip kind={item.state as "confirmed" | "provisional"} locale={locale} /><button type="button">{text(locale, "查看来源", "View source")}<ExternalLink aria-hidden="true" /></button></li>)}</ol>
    </section>
  );
}

function LocationList({ locale }: { locale: Locale }) {
  return (
    <ol className={styles.locationList}>
      {LOCATIONS.map((item, index) => <li key={item.en}><span>{index + 1}</span><div><strong>{text(locale, item.zh, item.en)}</strong><p>{text(locale, item.metaZh, item.metaEn)}</p><small>{index === 0 ? text(locale, "场所级精度 · 已确认", "Place-level precision · confirmed") : text(locale, "国家级精度 · 已确认", "Country-level precision · confirmed")}</small></div><button type="button">{text(locale, "打开场所", "Open place")}<ChevronRight aria-hidden="true" /></button></li>)}
    </ol>
  );
}
