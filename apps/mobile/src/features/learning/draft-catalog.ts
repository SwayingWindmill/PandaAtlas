import raw from "../../../../../data/curation/learning/learning.json";

import type { LearningDocument } from "./catalog";

/** The working copy. A production build does not call this. */
export function bundledLearningDocument(): LearningDocument {
  return raw as unknown as LearningDocument;
}
