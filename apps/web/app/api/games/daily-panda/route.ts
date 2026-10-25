import { NextResponse } from "next/server";

import { toDailyPandaClue } from "@/features/games/daily-panda-clues";
import { createServerV2Client, v2JsonResponse } from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await createServerV2Client().GET("/api/v2/games/daily-panda");
  if (!result.data) return v2JsonResponse(result);
  return NextResponse.json(
    { ...result.data, clues: result.data.clues.flatMap(toDailyPandaClue) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
