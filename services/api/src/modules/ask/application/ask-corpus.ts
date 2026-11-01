import { createHash } from "node:crypto";
import type { PublicLearningCatalog, LearningSource, LearningText } from "../../learning/application/learning-catalog.js";

// The knowledge 问问熊猫 may answer from: published learning entries and the sourced core facts of
// published pandas. Each document is one citable passage with the app page it came from and the
// outside sources behind it. Links shown to people always come from here, never from the model.

export type AskDocumentKind = "article" | "card" | "topic" | "term" | "faceGuide" | "challenge" | "panda";

export interface AskSourceLink {
  title: string;
  publisher: string | null;
  url: string;
}

export interface AskDocument {
  key: string;
  kind: AskDocumentKind;
  titleZh: string;
  titleEn: string | null;
  appPath: string;
  text: string;
  sources: AskSourceLink[];
}

export interface AskIndexedDocument extends AskDocument {
  contentSha256: string;
}

const MAX_KEY_CHARS = 128;
const MAX_SOURCES_PER_DOCUMENT = 6;

// [[term-slug|label]] links in learning copy read as their label.
function plain(text: string): string {
  return text.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/gu, "$1").replace(/\[\[([^\]]+)\]\]/gu, "$1").trim();
}

function textOf(value: Partial<LearningText> | undefined): { zh: string; en: string } {
  return { zh: plain(value?.zh ?? ""), en: plain(value?.en ?? "") };
}

function bilingual(value: Partial<LearningText> | undefined): string {
  const { zh, en } = textOf(value);
  return unique([zh, en]).join("\n");
}

function unique(parts: (string | null)[]): string[] {
  return parts.filter((part): part is string => part !== null && part !== "").filter((part, index, all) => all.indexOf(part) === index);
}

function learningSources(sources: LearningSource[]): AskSourceLink[] {
  return sources.slice(0, MAX_SOURCES_PER_DOCUMENT).map((source) => ({
    title: source.title.zh || source.title.en,
    publisher: null,
    url: source.url,
  }));
}

// AI Search infers an uploaded item's type from its name and rejects names without a supported
// extension (unsupported_file_type), so every key ends in ".md".
const KEY_EXTENSION = ".md";

function key(...parts: string[]): string {
  const joined = parts.join("/");
  if (joined.length + KEY_EXTENSION.length <= MAX_KEY_CHARS) return `${joined}${KEY_EXTENSION}`;
  // Keys are item names in AI Search (128 characters at most); a long slug keeps a stable hash.
  const digest = createHash("sha256").update(joined).digest("hex").slice(0, 16);
  return `${joined.slice(0, MAX_KEY_CHARS - 17 - KEY_EXTENSION.length)}~${digest}${KEY_EXTENSION}`;
}

function document(input: Omit<AskDocument, "titleEn" | "text"> & { titleEn: string; body: string[] }): AskDocument {
  const heading = unique([input.titleZh, input.titleEn]).join(" · ");
  return {
    key: input.key,
    kind: input.kind,
    titleZh: input.titleZh,
    titleEn: input.titleEn === "" ? null : input.titleEn,
    appPath: input.appPath,
    text: [`# ${heading}`, ...input.body.filter((line) => line.trim() !== "")].join("\n\n"),
    sources: input.sources,
  };
}

export function learningDocuments(catalog: PublicLearningCatalog): AskDocument[] {
  const documents: AskDocument[] = [];
  const articleSlugs = new Set(catalog.articles.map((article) => article.slug));

  for (const article of catalog.articles) {
    const title = textOf(article.title);
    const path = `/learn/articles/${article.slug}`;
    const references = new Map(article.references.map((reference) => [reference.id, reference]));
    const sourcesFor = (refs: string[]): AskSourceLink[] =>
      [...new Set(refs)]
        .map((ref) => references.get(ref))
        .filter((reference) => reference !== undefined)
        .slice(0, MAX_SOURCES_PER_DOCUMENT)
        .map((reference) => ({ title: reference.title, publisher: reference.publisher, url: reference.url }));

    article.body.sections.forEach((section, index) => {
      const heading = textOf(section.heading);
      documents.push(
        document({
          key: key("article", article.slug, `s${index + 1}`),
          kind: "article",
          titleZh: title.zh,
          titleEn: title.en,
          appPath: path,
          body: [heading.zh || heading.en, ...section.paragraphs.map((paragraph) => bilingual(paragraph.text))],
          sources: sourcesFor(section.paragraphs.flatMap((paragraph) => paragraph.refs)),
        }),
      );
    });
    if (article.keyFacts.length > 0) {
      documents.push(
        document({
          key: key("article", article.slug, "facts"),
          kind: "article",
          titleZh: title.zh,
          titleEn: title.en,
          appPath: path,
          body: ["要点 Key facts", ...article.keyFacts.map((fact) => `- ${bilingual(fact.text)}`)],
          sources: sourcesFor(article.keyFacts.flatMap((fact) => fact.refs)),
        }),
      );
    }
  }

  for (const card of catalog.cards) {
    const title = textOf(card.title);
    documents.push(
      document({
        key: key("card", card.slug),
        kind: "card",
        titleZh: title.zh,
        titleEn: title.en,
        appPath: articleSlugs.has(card.slug) ? `/learn/articles/${card.slug}` : "/learn",
        body: [bilingual(card.summary), bilingual(card.body)],
        sources: learningSources(card.sources),
      }),
    );
  }

  for (const topic of catalog.topics) {
    const title = textOf(topic.title);
    documents.push(
      document({
        key: key("topic", topic.slug),
        kind: "topic",
        titleZh: title.zh,
        titleEn: title.en,
        appPath: "/learn",
        body: [bilingual(topic.summary), ...topic.sections.map((section) => `${bilingual(section.heading)}\n${bilingual(section.body)}`)],
        sources: learningSources(topic.sources),
      }),
    );
  }

  for (const term of catalog.terms) {
    const title = textOf(term.term);
    documents.push(
      document({
        key: key("term", term.slug),
        kind: "term",
        titleZh: title.zh,
        titleEn: title.en,
        appPath: `/learn/terms/${term.slug}`,
        body: [bilingual(term.definition)],
        sources: learningSources(term.sources),
      }),
    );
  }

  for (const guide of catalog.faceGuides) {
    const title = textOf(guide.title);
    documents.push(
      document({
        key: key("faceGuide", guide.slug),
        kind: "faceGuide",
        titleZh: title.zh,
        titleEn: title.en,
        appPath: `/learn/faces/${guide.slug}`,
        body: guide.tips.map((tip) => `${bilingual(tip.label)}：${bilingual(tip.body)}`),
        sources: learningSources(guide.sources),
      }),
    );
  }

  for (const challenge of catalog.challenges) {
    const prompt = textOf(challenge.prompt);
    documents.push(
      document({
        key: key("challenge", challenge.slug),
        kind: "challenge",
        titleZh: prompt.zh,
        titleEn: prompt.en,
        appPath: "/learn/challenge",
        body: [bilingual(challenge.tip)],
        sources: learningSources(challenge.sources),
      }),
    );
  }

  return documents;
}

export interface AskPandaFacts {
  slug: string;
  nameZh: string | null;
  nameEn: string | null;
  sex: string | null;
  birthDate: string | null;
  birthDatePrecision: string | null;
  birthplace: string | null;
  lifeStatus: string | null;
  deathDate: string | null;
  currentFacility: string | null;
  currentLocation: string | null;
  parents: { role: string; nameZh: string | null; nameEn: string | null }[];
  children: { nameZh: string | null; nameEn: string | null }[];
  residencies: { placeZh: string | null; placeEn: string | null; startOn: string | null; endOn: string | null }[];
  provisional: string[];
  sources: AskSourceLink[];
}

const SEX = { female: "雌性 female", male: "雄性 male" } as Record<string, string>;
const LIFE = { alive: "在世 alive", deceased: "已离世 deceased", dead: "已离世 deceased" } as Record<string, string>;
const ROLE = { mother: "母亲 mother", father: "父亲 father", sire: "父亲 father", dam: "母亲 mother" } as Record<string, string>;

function both(zh: string | null, en: string | null): string {
  return unique([zh, en]).join(" ");
}

function dateText(date: string, precision: string | null): string {
  if (precision === "year") return date.slice(0, 4);
  if (precision === "month") return date.slice(0, 7);
  return date;
}

/** One passage per published panda, built only from fields that carry a public source. */
export function pandaDocument(panda: AskPandaFacts): AskDocument | null {
  const name = both(panda.nameZh, panda.nameEn);
  if (name === "" || panda.sources.length === 0) return null;
  const mark = (field: string) => (panda.provisional.includes(field) ? "（待核实 provisional）" : "");
  const lines: string[] = [`大熊猫个体 Giant panda: ${name}`];
  if (panda.sex !== null) lines.push(`- 性别 Sex: ${SEX[panda.sex] ?? panda.sex}${mark("sex")}`);
  if (panda.birthDate !== null) lines.push(`- 出生日期 Born: ${dateText(panda.birthDate, panda.birthDatePrecision)}${mark("birth_date")}`);
  if (panda.birthplace !== null) lines.push(`- 出生地 Birthplace: ${panda.birthplace}${mark("birthplace")}`);
  if (panda.lifeStatus !== null) lines.push(`- 状态 Status: ${LIFE[panda.lifeStatus] ?? panda.lifeStatus}${mark("life_status")}`);
  if (panda.deathDate !== null) lines.push(`- 离世日期 Died: ${panda.deathDate}${mark("death_date")}`);
  if (panda.currentFacility !== null) lines.push(`- 目前所在机构 Current facility: ${panda.currentFacility}${mark("current_facility")}`);
  else if (panda.currentLocation !== null) lines.push(`- 目前所在 Current location: ${panda.currentLocation}${mark("current_coarse_location")}`);
  for (const parent of panda.parents) {
    const parentName = both(parent.nameZh, parent.nameEn);
    if (parentName !== "") lines.push(`- ${ROLE[parent.role] ?? parent.role}: ${parentName}`);
  }
  const children = unique(panda.children.map((child) => both(child.nameZh, child.nameEn)).filter((childName) => childName !== ""));
  if (children.length > 0) lines.push(`- 子女 Offspring: ${children.join("；")}`);
  for (const residency of panda.residencies) {
    const place = both(residency.placeZh, residency.placeEn);
    if (place === "") continue;
    const span = [residency.startOn, residency.endOn].some((value) => value !== null)
      ? `（${residency.startOn ?? "?"} – ${residency.endOn ?? "至今 present"}）`
      : "";
    lines.push(`- 生活过的地方 Lived at: ${place}${span}`);
  }
  if (lines.length === 1) return null;
  return document({
    key: key("panda", panda.slug),
    kind: "panda",
    titleZh: panda.nameZh ?? panda.nameEn ?? panda.slug,
    titleEn: panda.nameEn ?? "",
    appPath: `/pandas/${panda.slug}`,
    // Several lineage assertions can name the same parent; say it once.
    body: unique(lines),
    sources: panda.sources.slice(0, MAX_SOURCES_PER_DOCUMENT),
  });
}

/** The hash covers everything the index and the app show, so any change re-uploads the passage. */
export function withContentHash(document: AskDocument): AskIndexedDocument {
  const contentSha256 = createHash("sha256")
    .update(JSON.stringify([document.kind, document.titleZh, document.titleEn, document.appPath, document.text, document.sources]))
    .digest("hex");
  return { ...document, contentSha256 };
}
