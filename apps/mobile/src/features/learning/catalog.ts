// What the 科普 screens show. Draft entries are part of the working file and of the
// database document; a production build asks for published entries only.

export type LearningStatus = "draft" | "published";

export interface LearningText {
  zh: string;
  en?: string;
}

export interface LearningSource {
  title: LearningText;
  url: string | null;
  citedOn: string | null;
}

export interface LearningCard {
  slug: string;
  status: LearningStatus;
  title: LearningText;
  summary: LearningText;
  body: LearningText;
  sources: LearningSource[];
}

export interface LearningSection {
  heading: LearningText;
  body: LearningText;
}

export interface LearningTopic {
  slug: string;
  status: LearningStatus;
  title: LearningText;
  summary: LearningText;
  sections: LearningSection[];
  cardSlugs: string[];
  sources: LearningSource[];
}

export interface LearningTerm {
  slug: string;
  status: LearningStatus;
  term: LearningText;
  definition: LearningText;
  relatedSlugs: string[];
  sources: LearningSource[];
}

export type FaceTipKey = "shape" | "leftRight" | "eyePatches" | "ears";

export interface LearningFaceTip {
  key: FaceTipKey;
  label: LearningText;
  body: LearningText;
}

export interface LearningFaceGuide {
  slug: string;
  status: LearningStatus;
  pandaSlug: string;
  title: LearningText;
  tips: LearningFaceTip[];
  sources: LearningSource[];
}

export interface LearningChallenge {
  slug: string;
  status: LearningStatus;
  answerPandaSlug: string;
  decoyPandaSlugs: string[];
  prompt: LearningText;
  tip: LearningText;
  sources: LearningSource[];
}

export interface LearningParagraph {
  text: LearningText;
  refs: string[];
}

export interface LearningArticleSection {
  heading: LearningText;
  paragraphs: LearningParagraph[];
}

export interface LearningFact {
  text: LearningText;
  refs: string[];
}

export interface LearningArticleImage {
  role: "hero" | "inline" | "compare";
  type: "existing" | "wanted";
  pandaSlug: string | null;
  asset?: string;
  sourcePage?: string;
  credit?: string;
  rights?: string;
  shot?: LearningText;
  caption: LearningText;
  captionRefs: string[];
}

export interface LearningArticleReference {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  citedOn: string | null;
}

export interface LearningArticle {
  slug: string;
  status: LearningStatus;
  category: string;
  title: LearningText;
  dek: LearningText;
  pullQuote: LearningText & { drawnFromBody?: boolean };
  body: { sections: LearningArticleSection[] };
  keyFacts: LearningFact[];
  images: LearningArticleImage[];
  references: LearningArticleReference[];
  relatedArticles: string[];
  stats: { bodyChars: number; bodyCjkChars: number; sectionCount: number; referenceCount: number };
  glossaryTerms: { slug: string; label: string; inLearningJson: boolean }[];
  sourceCardSlug?: string;
  sourceTopicSlug?: string;
}

export function articleHero(article: { images: LearningArticleImage[] }): LearningArticleImage | undefined {
  return article.images.find((image) => image.role === "hero" && image.type === "existing" && image.asset);
}

/** About 400 Chinese characters a minute. Derived from the draft, not stored as a separate claim. */
export function readingMinutes(article: { body: { sections: LearningArticleSection[] } }): number {
  const chars = article.body.sections.reduce(
    (sum, section) => sum + section.paragraphs.reduce((inner, paragraph) => inner + learningText(paragraph.text).length, 0),
    0,
  );
  return Math.max(1, Math.round(chars / 400));
}

export interface LearningDocument {
  version: string;
  articles: LearningArticle[];
  cards: LearningCard[];
  topics: LearningTopic[];
  terms: LearningTerm[];
  faceGuides: LearningFaceGuide[];
  challenges: LearningChallenge[];
}

export type CatalogArticle = Omit<LearningArticle, "status">;
export type CatalogCard = Omit<LearningCard, "status">;
export type CatalogTopic = Omit<LearningTopic, "status">;
export type CatalogTerm = Omit<LearningTerm, "status">;
export type CatalogFaceGuide = Omit<LearningFaceGuide, "status">;
export type CatalogChallenge = Omit<LearningChallenge, "status">;

export interface LearningCatalog {
  version: string;
  articles: CatalogArticle[];
  cards: CatalogCard[];
  topics: CatalogTopic[];
  terms: CatalogTerm[];
  faceGuides: CatalogFaceGuide[];
  challenges: CatalogChallenge[];
}

export interface LearningPanda {
  id: string;
  slug: string;
  name: string;
}

export interface ResolvedChallenge {
  slug: string;
  prompt: string;
  tip: string;
  answerSlug: string;
  photoPandaId: string;
  options: { slug: string; pandaId: string; name: string }[];
}

export interface PresentedOption {
  slug: string;
  pandaId: string;
  name: string;
  /** Cover photo. Null when this release has no picture of the panda. */
  photoUrl: string | null;
}

export interface PresentedChallenge {
  /** `compare`: a second photo is the question and the choices are named. `named`: one photo each, so the name is the question and the choices stay unnamed until the answer. */
  mode: "compare" | "named";
  title: string;
  questionPhotoUrl: string | null;
  options: PresentedOption[];
}

export class CatalogUnavailable extends Error {}

/** Chinese, then English. The app has no locale switch; the file keeps both. */
export function learningText(value: LearningText | undefined): string {
  const zh = value?.zh?.trim();
  if (zh) return zh;
  return value?.en?.trim() ?? "";
}

/** A face-guide tip with no body is a slot the writer left blank, so the screen omits it. */
export function visibleTips<T extends { body: LearningText }>(tips: readonly T[]): T[] {
  return tips.filter((tip) => learningText(tip.body).length > 0);
}

export function entryBySlug<T extends { slug: string }>(entries: readonly T[], slug: string): T | undefined {
  return entries.find((entry) => entry.slug === slug);
}

function withoutStatus<T extends { status: LearningStatus }>(entry: T): Omit<T, "status"> {
  const { status: _status, ...rest } = entry;
  return rest;
}

function visible<T extends { slug: string; status: LearningStatus }>(entries: readonly T[], includeDrafts: boolean): Omit<T, "status">[] {
  return entries.filter((entry) => includeDrafts || entry.status === "published").map(withoutStatus);
}

function mergeBySlug<T extends { slug: string }>(bundled: readonly T[], remote: readonly T[]): T[] {
  const remoteBySlug = new Map(remote.map((entry) => [entry.slug, entry]));
  const seen = new Set<string>();
  const merged = bundled.map((entry) => {
    seen.add(entry.slug);
    return remoteBySlug.get(entry.slug) ?? entry;
  });
  for (const entry of remote) {
    if (!seen.has(entry.slug)) merged.push(entry);
  }
  return merged;
}

/**
 * Production passes includeDrafts false and ignores the working file.
 * A development build shows the file's drafts, and a published API entry replaces the same slug.
 */
export function assembleCatalog(
  remote: LearningCatalog | null,
  bundled: LearningDocument | null,
  includeDrafts: boolean,
): LearningCatalog {
  if (!includeDrafts) {
    if (remote === null) throw new CatalogUnavailable("Learning catalog is unavailable");
    return remote;
  }
  const draftArticles = bundled ? visible(bundled.articles, true) : [];
  const draftCards = bundled ? visible(bundled.cards, true) : [];
  const draftTopics = bundled ? visible(bundled.topics, true) : [];
  const draftTerms = bundled ? visible(bundled.terms, true) : [];
  const draftGuides = bundled ? visible(bundled.faceGuides, true) : [];
  const draftChallenges = bundled ? visible(bundled.challenges, true) : [];
  return {
    version: remote?.version || bundled?.version || "",
    articles: mergeBySlug(draftArticles, remote?.articles ?? []),
    cards: mergeBySlug(draftCards, remote?.cards ?? []),
    topics: mergeBySlug(draftTopics, remote?.topics ?? []),
    terms: mergeBySlug(draftTerms, remote?.terms ?? []),
    faceGuides: mergeBySlug(draftGuides, remote?.faceGuides ?? []),
    challenges: mergeBySlug(draftChallenges, remote?.challenges ?? []),
  };
}

export function catalogIsEmpty(catalog: LearningCatalog): boolean {
  return (
    catalog.articles.length === 0 &&
    catalog.cards.length === 0 &&
    catalog.topics.length === 0 &&
    catalog.terms.length === 0 &&
    catalog.faceGuides.length === 0 &&
    catalog.challenges.length === 0
  );
}

/** Four named options, or null when any panda is absent from the published list. */
export function resolveChallenge(challenge: CatalogChallenge, pandas: readonly LearningPanda[]): ResolvedChallenge | null {
  const slugs = [challenge.answerPandaSlug, ...challenge.decoyPandaSlugs];
  const options = slugs.map((pandaSlug) => {
    const panda = pandas.find((item) => item.slug === pandaSlug);
    return panda === undefined ? null : { slug: panda.slug, pandaId: panda.id, name: panda.name };
  });
  if (options.some((option) => option === null)) return null;
  const ready = options.filter((option): option is NonNullable<typeof option> => option !== null);
  const answer = ready.find((option) => option.slug === challenge.answerPandaSlug);
  if (answer === undefined) return null;
  return {
    slug: challenge.slug,
    prompt: learningText(challenge.prompt),
    tip: learningText(challenge.tip),
    answerSlug: answer.slug,
    photoPandaId: answer.pandaId,
    options: [...ready].sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

/**
 * The question must not be the same picture as the correct choice, and the choice must not be
 * labeled with the name when that name is the question.
 * A second published photo of the answer panda becomes the question; the choice keeps the cover.
 * With only one photo, the question is 「哪一只是{名字}？」 and there is no large photo.
 */
export function presentChallenge(round: ResolvedChallenge, photos: ReadonlyMap<string, readonly string[]>): PresentedChallenge {
  const options: PresentedOption[] = round.options.map((option) => ({
    slug: option.slug,
    pandaId: option.pandaId,
    name: option.name,
    photoUrl: photos.get(option.pandaId)?.[0] ?? null,
  }));
  const answer = options.find((option) => option.slug === round.answerSlug);
  const answerPhotos = photos.get(round.photoPandaId) ?? [];
  const cover = answerPhotos[0];
  const other = answerPhotos.find((url) => url !== cover);
  if (other) {
    return { mode: "compare", title: round.prompt, questionPhotoUrl: other, options };
  }
  return { mode: "named", title: `哪一只是${answer?.name ?? ""}？`, questionPhotoUrl: null, options };
}
