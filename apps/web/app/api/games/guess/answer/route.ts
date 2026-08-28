import { NextRequest, NextResponse } from "next/server";

import { createServerV2Client, v2JsonResponse } from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

function displayName(
  names: Array<{ languageTag: string; value: string; isPrimary: boolean }>,
  locale: "zh" | "en",
): string | null {
  const preferredTags = locale === "zh" ? ["zh-Hans", "zh-CN", "zh"] : ["en"];
  for (const tag of preferredTags) {
    const match = names.find((name) => name.languageTag === tag && name.isPrimary)
      ?? names.find((name) => name.languageTag === tag);
    if (match) return match.value;
  }
  return names.find((name) => name.isPrimary)?.value ?? names[0]?.value ?? null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    questionId: string;
    selectedPandaId: string;
    locale?: "zh" | "en";
  };
  const locale = body.locale === "en" ? "en" : "zh";
  const client = createServerV2Client();
  const answerResult = await client.POST("/api/v2/games/guess/answer", {
    body: {
      questionId: body.questionId,
      selectedPandaId: body.selectedPandaId,
    },
  });
  if (!answerResult.data) return v2JsonResponse(answerResult);

  const pandaListResult = await client.GET("/api/v2/pandas");
  if (!pandaListResult.data) return v2JsonResponse(pandaListResult);
  const answerPanda = pandaListResult.data.items.find(
    (panda) => panda.pandaId === answerResult.data.answerPandaId,
  );
  const name = answerPanda ? displayName(answerPanda.names, locale) : null;
  if (!answerPanda || !name) {
    return NextResponse.json(
      { detail: "The answer panda is unavailable in the active public release." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      correct: answerResult.data.correct,
      answer: {
        pandaId: answerPanda.pandaId,
        name,
        slug: answerPanda.canonicalSlug,
      },
      recognitionTips: answerResult.data.recognitionTips,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
