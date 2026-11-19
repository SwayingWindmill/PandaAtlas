import type { LearningDocument } from "./catalog";

/** The working copy. A production build receives null so the JSON is only loaded in development. */
export function bundledLearningDocument(): LearningDocument | null {
  if (!__DEV__) return null;
  return require("../../../../../data/curation/learning/learning.json") as LearningDocument;
}
