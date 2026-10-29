import { api } from "@/lib/api";

import { type LearningCatalog, assembleCatalog } from "./catalog";
import { bundledLearningDocument } from "./draft-catalog";

// Development builds preview the working file, including drafts. Production builds
// render only what GET /api/v2/learning returns, which is published entries.
export const includeLearningDrafts = __DEV__;

export async function loadLearningCatalog(): Promise<LearningCatalog> {
  let remote: LearningCatalog | null = null;
  try {
    const { data } = await api.GET("/api/v2/learning");
    // The OpenAPI block is a flat bag of optional fields. The server only returns one shape per block type.
    if (data) remote = data as unknown as LearningCatalog;
  } catch {
    remote = null;
  }
  return assembleCatalog(remote, includeLearningDrafts ? bundledLearningDocument() : null, includeLearningDrafts);
}
