import type { Route } from "next";
import Link from "next/link";

import { LEGAL_CONTACT_EMAIL } from "@/features/legal/documents";
import type { PublicLocale } from "@/lib/locales";

interface AboutSection {
  id: string;
  heading: string;
  paragraphs?: string[];
  principles?: Array<{ title: string; body: string }>;
}

interface AboutCopy {
  title: string;
  description: string;
  tocLabel: string;
  sections: AboutSection[];
  contactLead: string;
  correctionLink: string;
}

export const aboutCopy: Record<PublicLocale, AboutCopy> = {
  zh: {
    title: "关于吱熊猫",
    description: "认识每一只大熊猫：它们的家族、生活过的地方和最近动态。",
    tocLabel: "页面目录",
    sections: [
      {
        id: "what",
        heading: "吱熊猫是什么",
        paragraphs: [
          "吱熊猫是一个大熊猫资料站，包括网站 www.zhipanda.com 和吱熊猫 App。你可以查熊猫资料、看家族关系、在地图上找它们生活过的地方，也可以关注喜欢的熊猫，收到它们的新动态。",
        ],
      },
      {
        id: "method",
        heading: "资料怎样核实",
        principles: [
          { title: "每条事实都有出处", body: "出生、迁居、亲子关系都对应机构公告、新闻报道或研究文献。" },
          { title: "先审核，再发布", body: "新资料经人工审核后才出现在页面上。" },
          { title: "不确定就标出来", body: "暂定或有争议的记录会带标签，不会写成定论。" },
          { title: "照片注明署名和许可", body: "只用授权清楚的照片，作者和许可写在图下。" },
        ],
      },
      {
        id: "sources",
        heading: "资料来源",
        paragraphs: [
          "熊猫资料主要参考 Giant Panda Global 的熊猫数据库，以及成都大熊猫繁育研究基地、亚特兰大动物园、维也纳美泉宫动物园、香港海洋公园、东京动物园协会等机构的公告。",
          "科普文章主要参考国家林业和草原局、成都大熊猫繁育研究基地和史密森尼国家动物园公开的资料。",
          "照片大多来自 Wikimedia Commons 上的摄影作者。谢谢他们。",
        ],
      },
      { id: "contact", heading: "联系和纠错" },
    ],
    contactLead: "发现资料有误，或有其他事情，请写信到",
    correctionLink: "提交纠错",
  },
  en: {
    title: "About ZhiPanda",
    description: "Get to know every giant panda: their families, the places they have lived, and their latest updates.",
    tocLabel: "On this page",
    sections: [
      {
        id: "what",
        heading: "What ZhiPanda is",
        paragraphs: [
          "ZhiPanda is a giant panda reference: the website at www.zhipanda.com and the ZhiPanda app. Look up a panda, explore its family, find the places it has lived on the map, and follow the pandas you love to get their updates.",
        ],
      },
      {
        id: "method",
        heading: "How information is checked",
        principles: [
          { title: "Every fact has a source", body: "Births, moves, and parentage each trace to an institution notice, a news report, or a study." },
          { title: "Reviewed before it is published", body: "New information appears on a page only after a person has reviewed it." },
          { title: "Uncertainty is labelled", body: "Tentative or disputed records carry a label instead of being stated as settled." },
          { title: "Photos carry credit and licence", body: "Only clearly licensed photos are used. The author and licence appear under each one." },
        ],
      },
      {
        id: "sources",
        heading: "Sources",
        paragraphs: [
          "Panda records draw mainly on the Giant Panda Global database and on notices from the Chengdu Research Base of Giant Panda Breeding, Zoo Atlanta, Vienna Zoo, Ocean Park Hong Kong, the Tokyo Zoological Park Society, and other institutions.",
          "Learn articles draw mainly on published material from China's National Forestry and Grassland Administration, the Chengdu Research Base, and Smithsonian's National Zoo.",
          "Most photos come from photographers on Wikimedia Commons. Thank you.",
        ],
      },
      { id: "contact", heading: "Contact and corrections" },
    ],
    contactLead: "If something is wrong, or for anything else, write to",
    correctionLink: "Submit a correction",
  },
};

export function AboutPage({ locale, correctionsEnabled }: { locale: PublicLocale; correctionsEnabled: boolean }) {
  const copy = aboutCopy[locale];
  return (
    <main id="main-content" className="text-[var(--pa-color-ink)]">
      <div className="pa-shell grid gap-10 py-10 sm:py-14 md:grid-cols-[12rem_minmax(0,42rem)] md:gap-14">
        <nav aria-label={copy.tocLabel} className="hidden md:block">
          <ul className="sticky top-6 grid gap-2 text-sm text-[var(--pa-color-ink-muted)]">
            {copy.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="hover:text-[var(--pa-color-ink)]">{section.heading}</a>
              </li>
            ))}
          </ul>
        </nav>
        <article className="grid gap-10">
          <header className="grid gap-3">
            <h1>{copy.title}</h1>
            <p className="text-[var(--pa-color-ink-muted)]">{copy.description}</p>
          </header>
          {copy.sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id} className="grid gap-3">
              <h2 id={section.id} className="scroll-mt-6">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.principles ? (
                <dl className="grid border-t-[0.5px] border-[var(--pa-color-line)]">
                  {section.principles.map((principle) => (
                    <div key={principle.title} className="grid gap-1 border-b-[0.5px] border-[var(--pa-color-line)] py-3">
                      <dt className="font-bold">{principle.title}</dt>
                      <dd className="text-[var(--pa-color-ink-muted)]">{principle.body}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {section.id === "contact" ? (
                <>
                  <p>
                    {copy.contactLead}{" "}
                    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-bold hover:underline hover:underline-offset-[3px]">
                      {LEGAL_CONTACT_EMAIL}
                    </a>
                    {locale === "zh" ? "。" : "."}
                  </p>
                  {correctionsEnabled ? (
                    <p>
                      <Link
                        href={`/${locale}/contribute` as Route}
                        className="inline-flex min-h-10 items-center rounded-full bg-[var(--pa-color-surface-subtle)] px-4 text-sm font-bold hover:bg-[var(--pa-color-surface-hover)]"
                      >
                        {copy.correctionLink}
                      </Link>
                    </p>
                  ) : null}
                </>
              ) : null}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
