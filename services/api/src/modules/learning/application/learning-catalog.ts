// The curated learning document holds drafts and published entries. The public
// catalog is the published ones only, so a production response never carries draft copy.

const FACE_TIP_KEYS = ["shape", "leftRight", "eyePatches", "ears"] as const;

export type FaceTipKey = (typeof FACE_TIP_KEYS)[number];

export interface LearningText {
  zh: string;
  en: string;
}

export interface LearningSource {
  title: LearningText;
  url: string;
  citedOn: string;
}

export interface PublicLearningCard {
  slug: string;
  title: LearningText;
  summary: LearningText;
  body: LearningText;
  sources: LearningSource[];
}

export interface PublicLearningTopic {
  slug: string;
  title: LearningText;
  summary: LearningText;
  sections: { heading: LearningText; body: LearningText }[];
  cardSlugs: string[];
  sources: LearningSource[];
}

export interface PublicLearningTerm {
  slug: string;
  term: LearningText;
  definition: LearningText;
  relatedSlugs: string[];
  sources: LearningSource[];
}

export interface PublicLearningFaceGuide {
  slug: string;
  pandaSlug: string;
  title: LearningText;
  tips: { key: FaceTipKey; label: LearningText; body: LearningText }[];
  sources: LearningSource[];
}

export interface PublicLearningChallenge {
  slug: string;
  answerPandaSlug: string;
  decoyPandaSlugs: string[];
  prompt: LearningText;
  tip: LearningText;
  sources: LearningSource[];
}

export interface PublicLearningArticle {
  slug: string;
  category: string;
  title: LearningText;
  dek: LearningText;
  pullQuote: LearningText;
  body: { sections: { heading: LearningText; paragraphs: { text: LearningText; refs: string[] }[] }[] };
  keyFacts: { text: LearningText; refs: string[] }[];
  images: {
    role: string;
    type: string;
    pandaSlug: string | null;
    asset?: string;
    credit?: string;
    caption: LearningText;
    shot?: LearningText;
  }[];
  references: { id: string; title: string; publisher: string; url: string; citedOn: string }[];
  relatedArticles: string[];
}

export interface PublicLearningCatalog {
  version: string;
  articles: PublicLearningArticle[];
  cards: PublicLearningCard[];
  topics: PublicLearningTopic[];
  terms: PublicLearningTerm[];
  faceGuides: PublicLearningFaceGuide[];
  challenges: PublicLearningChallenge[];
}

export const EMPTY_LEARNING_CATALOG: PublicLearningCatalog = {
  version: "",
  articles: [],
  cards: [],
  topics: [],
  terms: [],
  faceGuides: [],
  challenges: [],
};

export class LearningCatalogError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LearningCatalogError";
  }
}

export interface LearningCatalogRow {
  version: string;
  document: unknown;
}

function fail(message: string): never {
  throw new LearningCatalogError(message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const present = Object.keys(value);
  if (present.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    fail(`${label} must have ${keys.join(", ")}`);
  }
}

function text(value: unknown, label: string): LearningText {
  const item = record(value, label);
  exactKeys(item, ["zh", "en"], label);
  if (typeof item.zh !== "string" || typeof item.en !== "string") fail(`${label} needs zh and en strings`);
  return { zh: item.zh, en: item.en };
}

function slug(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) fail(`${label} must be a slug`);
  return value;
}

function slugs(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) fail(`${label} must be a list of slugs`);
  return value.map((item, index) => slug(item, `${label}[${index}]`));
}

function sources(value: unknown, label: string, published: boolean): LearningSource[] {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} needs a source`);
  return value.map((item, index) => {
    const source = record(item, `${label}[${index}]`);
    exactKeys(source, ["title", "url", "citedOn"], `${label}[${index}]`);
    const title = text(source.title, `${label}[${index}].title`);
    if (!published) return { title, url: "", citedOn: "" };
    if (typeof source.url !== "string" || !source.url.startsWith("https://")) fail(`${label}[${index}].url must be https`);
    if (typeof source.citedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(source.citedOn)) {
      fail(`${label}[${index}].citedOn must be a day`);
    }
    return { title, url: source.url, citedOn: source.citedOn };
  });
}

function statusOf(value: Record<string, unknown>, label: string): "draft" | "published" {
  if (value.status !== "draft" && value.status !== "published") fail(`${label}.status must be draft or published`);
  return value.status;
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be a list`);
  return value;
}

/** Published entries from a catalog row. A missing row is an empty catalog. An invalid document fails closed. */
export function publishedCatalog(row: LearningCatalogRow | null): PublicLearningCatalog {
  if (row === null) return EMPTY_LEARNING_CATALOG;
  const document = record(row.document, "document");
  exactKeys(document, ["version", "articles", "cards", "topics", "terms", "faceGuides", "challenges"], "document");
  if (document.version !== row.version || typeof document.version !== "string") fail("document version does not match the catalog");

  const cards = list(document.cards, "cards").flatMap((item, index): PublicLearningCard[] => {
    const card = record(item, `cards[${index}]`);
    exactKeys(card, ["slug", "status", "title", "summary", "body", "sources"], `cards[${index}]`);
    const status = statusOf(card, `cards[${index}]`);
    const projected = {
      slug: slug(card.slug, `cards[${index}].slug`),
      title: text(card.title, `cards[${index}].title`),
      summary: text(card.summary, `cards[${index}].summary`),
      body: text(card.body, `cards[${index}].body`),
      sources: sources(card.sources, `cards[${index}].sources`, status === "published"),
    };
    return status === "published" ? [projected] : [];
  });

  const topics = list(document.topics, "topics").flatMap((item, index): PublicLearningTopic[] => {
    const topic = record(item, `topics[${index}]`);
    exactKeys(topic, ["slug", "status", "title", "summary", "sections", "cardSlugs", "sources"], `topics[${index}]`);
    const status = statusOf(topic, `topics[${index}]`);
    const sections = list(topic.sections, `topics[${index}].sections`).map((section, sectionIndex) => {
      const fields = record(section, `topics[${index}].sections[${sectionIndex}]`);
      exactKeys(fields, ["heading", "body"], `topics[${index}].sections[${sectionIndex}]`);
      return {
        heading: text(fields.heading, `topics[${index}].sections[${sectionIndex}].heading`),
        body: text(fields.body, `topics[${index}].sections[${sectionIndex}].body`),
      };
    });
    const projected = {
      slug: slug(topic.slug, `topics[${index}].slug`),
      title: text(topic.title, `topics[${index}].title`),
      summary: text(topic.summary, `topics[${index}].summary`),
      sections,
      cardSlugs: slugs(topic.cardSlugs, `topics[${index}].cardSlugs`),
      sources: sources(topic.sources, `topics[${index}].sources`, status === "published"),
    };
    return status === "published" ? [projected] : [];
  });

  const terms = list(document.terms, "terms").flatMap((item, index): PublicLearningTerm[] => {
    const term = record(item, `terms[${index}]`);
    exactKeys(term, ["slug", "status", "term", "definition", "relatedSlugs", "sources"], `terms[${index}]`);
    const status = statusOf(term, `terms[${index}]`);
    const projected = {
      slug: slug(term.slug, `terms[${index}].slug`),
      term: text(term.term, `terms[${index}].term`),
      definition: text(term.definition, `terms[${index}].definition`),
      relatedSlugs: slugs(term.relatedSlugs, `terms[${index}].relatedSlugs`),
      sources: sources(term.sources, `terms[${index}].sources`, status === "published"),
    };
    return status === "published" ? [projected] : [];
  });

  const faceGuides = list(document.faceGuides, "faceGuides").flatMap((item, index): PublicLearningFaceGuide[] => {
    const guide = record(item, `faceGuides[${index}]`);
    exactKeys(guide, ["slug", "status", "pandaSlug", "title", "tips", "sources"], `faceGuides[${index}]`);
    const status = statusOf(guide, `faceGuides[${index}]`);
    const tips = list(guide.tips, `faceGuides[${index}].tips`).map((tip, tipIndex) => {
      const fields = record(tip, `faceGuides[${index}].tips[${tipIndex}]`);
      exactKeys(fields, ["key", "label", "body"], `faceGuides[${index}].tips[${tipIndex}]`);
      if (!FACE_TIP_KEYS.includes(fields.key as FaceTipKey)) fail(`faceGuides[${index}].tips[${tipIndex}].key is unknown`);
      return {
        key: fields.key as FaceTipKey,
        label: text(fields.label, `faceGuides[${index}].tips[${tipIndex}].label`),
        body: text(fields.body, `faceGuides[${index}].tips[${tipIndex}].body`),
      };
    });
    if (tips.map((tip) => tip.key).join() !== FACE_TIP_KEYS.join()) fail(`faceGuides[${index}].tips must be shape, leftRight, eyePatches, ears`);
    const projected = {
      slug: slug(guide.slug, `faceGuides[${index}].slug`),
      pandaSlug: slug(guide.pandaSlug, `faceGuides[${index}].pandaSlug`),
      title: text(guide.title, `faceGuides[${index}].title`),
      tips,
      sources: sources(guide.sources, `faceGuides[${index}].sources`, status === "published"),
    };
    return status === "published" ? [projected] : [];
  });

  const challenges = list(document.challenges, "challenges").flatMap((item, index): PublicLearningChallenge[] => {
    const challenge = record(item, `challenges[${index}]`);
    exactKeys(challenge, ["slug", "status", "answerPandaSlug", "decoyPandaSlugs", "prompt", "tip", "sources"], `challenges[${index}]`);
    const status = statusOf(challenge, `challenges[${index}]`);
    const decoys = slugs(challenge.decoyPandaSlugs, `challenges[${index}].decoyPandaSlugs`);
    if (decoys.length !== 3) fail(`challenges[${index}] needs three decoys`);
    const projected = {
      slug: slug(challenge.slug, `challenges[${index}].slug`),
      answerPandaSlug: slug(challenge.answerPandaSlug, `challenges[${index}].answerPandaSlug`),
      decoyPandaSlugs: decoys,
      prompt: text(challenge.prompt, `challenges[${index}].prompt`),
      tip: text(challenge.tip, `challenges[${index}].tip`),
      sources: sources(challenge.sources, `challenges[${index}].sources`, status === "published"),
    };
    return status === "published" ? [projected] : [];
  });

  const articles = list(document.articles, "articles").flatMap((item, index) => projectArticle(item, index));

  return { version: row.version, articles, cards, topics, terms, faceGuides, challenges };
}

const ARTICLE_KEYS = [
  "slug",
  "status",
  "category",
  "title",
  "dek",
  "pullQuote",
  "body",
  "keyFacts",
  "images",
  "references",
  "relatedArticles",
  "stats",
  "glossaryTerms",
] as const;

function projectArticle(item: unknown, index: number): PublicLearningArticle[] {
  const article = record(item, `articles[${index}]`);
  const sourceKey = ["sourceCardSlug", "sourceTopicSlug"].filter((key) => Object.hasOwn(article, key));
  if (sourceKey.length !== 1) fail(`articles[${index}] needs one source slug`);
  exactKeys(article, [...ARTICLE_KEYS, sourceKey[0] ?? ""], `articles[${index}]`);
  const status = statusOf(article, `articles[${index}]`);
  if (typeof article.category !== "string") fail(`articles[${index}].category must be a string`);
  const projected: PublicLearningArticle = {
    slug: slug(article.slug, `articles[${index}].slug`),
    category: article.category,
    title: zhText(article.title, `articles[${index}].title`),
    dek: zhText(article.dek, `articles[${index}].dek`),
    pullQuote: zhText(article.pullQuote, `articles[${index}].pullQuote`, ["drawnFromBody"]),
    body: articleBody(article.body, `articles[${index}].body`),
    keyFacts: articleFacts(article.keyFacts, `articles[${index}].keyFacts`),
    images: articleImages(article.images, `articles[${index}].images`),
    references: articleReferences(article.references, `articles[${index}].references`, status === "published"),
    relatedArticles: slugs(article.relatedArticles, `articles[${index}].relatedArticles`),
  };
  return status === "published" ? [projected] : [];
}

function zhText(value: unknown, label: string, extra: string[] = []): LearningText {
  const item = record(value, label);
  const allowed = new Set(["zh", "en", ...extra]);
  if (!Object.hasOwn(item, "zh") || Object.keys(item).some((key) => !allowed.has(key))) fail(`${label} must include zh`);
  if (typeof item.zh !== "string") fail(`${label}.zh must be a string`);
  if (item.en !== undefined && typeof item.en !== "string") fail(`${label}.en must be a string`);
  return { zh: item.zh, en: typeof item.en === "string" ? item.en : "" };
}

function articleBody(value: unknown, label: string): PublicLearningArticle["body"] {
  const body = record(value, label);
  exactKeys(body, ["sections"], label);
  const sections = list(body.sections, `${label}.sections`).map((section, index) => {
    const fields = record(section, `${label}.sections[${index}]`);
    exactKeys(fields, ["heading", "paragraphs"], `${label}.sections[${index}]`);
    return {
      heading: zhText(fields.heading, `${label}.sections[${index}].heading`),
      paragraphs: list(fields.paragraphs, `${label}.sections[${index}].paragraphs`).map((paragraph, paragraphIndex) => {
        const row = record(paragraph, `${label}.sections[${index}].paragraphs[${paragraphIndex}]`);
        exactKeys(row, ["text", "refs"], `${label}.sections[${index}].paragraphs[${paragraphIndex}]`);
        return { text: zhText(row.text, `${label}.sections[${index}].paragraphs[${paragraphIndex}].text`), refs: slugs(row.refs, `${label}.refs`) };
      }),
    };
  });
  return { sections };
}

function articleFacts(value: unknown, label: string): PublicLearningArticle["keyFacts"] {
  return list(value, label).map((fact, index) => {
    const row = record(fact, `${label}[${index}]`);
    exactKeys(row, ["text", "refs"], `${label}[${index}]`);
    return { text: zhText(row.text, `${label}[${index}].text`), refs: slugs(row.refs, `${label}[${index}].refs`) };
  });
}

function articleImages(value: unknown, label: string): PublicLearningArticle["images"] {
  return list(value, label).map((image, index) => {
    const row = record(image, `${label}[${index}]`);
    if (row.type === "wanted") {
      return {
        role: typeof row.role === "string" ? row.role : fail(`${label}[${index}].role`),
        type: "wanted",
        pandaSlug: typeof row.pandaSlug === "string" ? row.pandaSlug : null,
        caption: zhText(row.caption, `${label}[${index}].caption`),
        shot: row.shot === undefined ? undefined : zhText(row.shot, `${label}[${index}].shot`),
      };
    }
    if (row.type !== "existing" || typeof row.asset !== "string") fail(`${label}[${index}] must be an existing or wanted figure`);
    return {
      role: typeof row.role === "string" ? row.role : fail(`${label}[${index}].role`),
      type: "existing",
      pandaSlug: typeof row.pandaSlug === "string" ? row.pandaSlug : null,
      asset: row.asset,
      credit: typeof row.credit === "string" ? row.credit : "",
      caption: zhText(row.caption, `${label}[${index}].caption`),
    };
  });
}

function articleReferences(value: unknown, label: string, published: boolean): PublicLearningArticle["references"] {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} needs a reference`);
  return value.map((item, index) => {
    const reference = record(item, `${label}[${index}]`);
    exactKeys(reference, ["id", "title", "publisher", "url", "citedOn"], `${label}[${index}]`);
    if (typeof reference.title !== "string" || typeof reference.publisher !== "string") fail(`${label}[${index}] needs title and publisher`);
    if (!published) return { id: slug(reference.id, `${label}[${index}].id`), title: reference.title, publisher: reference.publisher, url: "", citedOn: "" };
    if (typeof reference.url !== "string" || !reference.url.startsWith("https://")) fail(`${label}[${index}].url must be https`);
    if (typeof reference.citedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(reference.citedOn)) fail(`${label}[${index}].citedOn must be a day`);
    return { id: slug(reference.id, `${label}[${index}].id`), title: reference.title, publisher: reference.publisher, url: reference.url, citedOn: reference.citedOn };
  });
}
