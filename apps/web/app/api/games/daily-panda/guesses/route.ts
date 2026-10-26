import { NextRequest, NextResponse } from "next/server";

import { toDailyPandaClue } from "@/features/games/daily-panda-clues";
import { createServerV2Client, v2JsonResponse } from "@/lib/server/v2-api";
import { refuseStateChange } from "@/lib/server/v2-forwarding";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const refused = refuseStateChange(request);
  if (refused !== undefined) return refused;
  const body = (await request.json()) as { guessPandaIds?: unknown };
  const guessPandaIds = Array.isArray(body.guessPandaIds)
    ? body.guessPandaIds.filter((id): id is string => typeof id === "string")
    : [];
  const result = await createServerV2Client().POST("/api/v2/games/daily-panda/guesses", {
    body: { guessPandaIds },
  });
  if (!result.data) return v2JsonResponse(result);
  return NextResponse.json(
    { ...result.data, clues: result.data.clues.flatMap(toDailyPandaClue) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
