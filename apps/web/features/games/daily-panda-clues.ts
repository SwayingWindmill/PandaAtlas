import type { components } from "@zhipanda/api-client";

import type { DailyPandaClue } from "@/features/fan/api/types";
import { publicMediaUrl } from "@/lib/media/public-media";

export type { DailyPandaClue } from "@/features/fan/api/types";

type ApiClue = components["schemas"]["DailyPandaClueDto"];

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
