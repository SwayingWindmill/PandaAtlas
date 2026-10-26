import type { components } from "@zhipanda/api-client";

import { api, authedApi } from "@/lib/api";
import { displayName } from "@/lib/panda";

type Submission = components["schemas"]["SubmitContributionDto"];
export type ContributionRecord = components["schemas"]["ContributionRecordDto"];

export interface CorrectionTarget {
  pandaId: string;
  name: string;
  releaseVersion: string;
}

/** The panda and the public release the fan is looking at, which reviewers compare the report against. */
export async function loadCorrectionTarget(slug: string): Promise<CorrectionTarget> {
  const { data } = await api.GET("/api/v2/pandas/{slug}", { params: { path: { slug } } });
  if (!data) throw new Error(`Panda ${slug} unavailable`);
  return { pandaId: data.panda.pandaId, name: displayName(data.panda), releaseVersion: data.release.version };
}

export async function submitCorrection(submission: Submission): Promise<void> {
  const { response } = await authedApi.POST("/api/v2/contributions", { body: submission });
  if (!response.ok) throw new Error(`Contribution not accepted (${response.status})`);
}

/** Newest first. */
export async function loadMyContributions(): Promise<ContributionRecord[]> {
  const { data } = await authedApi.GET("/api/v2/me/contributions");
  if (!data) throw new Error("Contributions unavailable");
  return [...data.items].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
