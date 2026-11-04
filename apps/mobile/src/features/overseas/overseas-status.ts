import { api } from "@/lib/api";

export type OverseasStage = "abroad" | "return_announced" | "in_transit" | "quarantine" | "returned";

export type PartialDate = { on: string; precision: "day" | "month" | "year" };

export type OverseasStatusItem = {
  pandaSlug: string;
  stage: OverseasStage;
  institutionSlug: string;
  expectedReturn?: PartialDate;
  returnedOn?: string;
  sourceUrl: string;
  sourcePublisher: string;
  updatedAt: string;
};

/** Published 海外大熊猫状态. Every entry carries its source and the time it was last checked. */
export async function loadOverseasStatus(): Promise<OverseasStatusItem[]> {
  const { data, error } = await api.GET("/api/v2/overseas-status");
  if (error || !data) throw new Error("overseas status unavailable");
  return (data.items as OverseasStatusItem[]).filter((item) => item.sourceUrl.startsWith("https://"));
}

export { type ReturnGroup, STAGES, partialDate, returnMeta, returnSections, sourceHost, updatedDay } from "./format";
