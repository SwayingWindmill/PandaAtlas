import type { components } from "@zhipanda/api-client";

import { publicMediaUrl } from "@/lib/media/public-media";

type ApiClue = components["schemas"]["DailyPandaClueDto"];

// Clues as the browser shows them, in reveal order. The photo clue carries a ready image URL.
export type DailyPandaClue =
  | { kind: "sex"; value: "female" | "male" }
  | { kind: "birth_year"; value: number }
  | { kind: "life_status"; value: "alive" | "deceased" }
  | { kind: "birthplace"; value: string }
  | { kind: "name_initial"; value: string }
  | { kind: "photo"; imageUrl: string };

export function toDailyPandaClue(clue: ApiClue): DailyPandaClue[] {
  switch (clue.kind) {
    case "sex":
      return clue.value === "female" || clue.value === "male" ? [{ kind: "sex", value: clue.value }] : [];
    case "birth_year":
      return typeof clue.value === "number" ? [{ kind: "birth_year", value: clue.value }] : [];
    case "life_status":
      return clue.value === "alive" || clue.value === "deceased" ? [{ kind: "life_status", value: clue.value }] : [];
    case "birthplace":
    case "name_initial":
      return typeof clue.value === "string" ? [{ kind: clue.kind, value: clue.value }] : [];
    case "photo":
      return clue.objectKey ? [{ kind: "photo", imageUrl: publicMediaUrl(clue.objectKey) }] : [];
    default:
      return [];
  }
}
