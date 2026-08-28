import { NextRequest, NextResponse } from "next/server";

import { publicMediaUrl } from "@/lib/media/public-media";
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

export async function GET(request: NextRequest) {
  const difficulty = request.nextUrl.searchParams.get("difficulty");
  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "zh";
  const query: { difficulty?: "easy" | "medium" | "hard" } =
    difficulty === "easy" || difficulty === "medium" || difficulty === "hard"
      ? { difficulty }
      : {};
  const client = createServerV2Client();

  const questionResult = await client.GET("/api/v2/games/guess/question", {
    params: { query },
  });
  if (!questionResult.data) return v2JsonResponse(questionResult);

  const pandaListResult = await client.GET("/api/v2/pandas");
  if (!pandaListResult.data) return v2JsonResponse(pandaListResult);

  const pandasById = new Map(pandaListResult.data.items.map((panda) => [panda.pandaId, panda]));
  const options = questionResult.data.optionPandaIds.flatMap((pandaId) => {
    const panda = pandasById.get(pandaId);
    if (!panda) return [];
    const name = displayName(panda.names, locale);
    return name ? [{ pandaId, name, slug: panda.canonicalSlug }] : [];
  });
  if (options.length !== questionResult.data.optionPandaIds.length) {
    return NextResponse.json(
      { detail: "The published game question references a panda missing from the active public release." },
      { status: 503 },
    );
  }

  const detailResults = await Promise.all(
    options.map((option) =>
      client.GET("/api/v2/pandas/{slug}", {
        params: { path: { slug: option.slug } },
      }),
    ),
  );
  const media = detailResults
    .flatMap((result) => result.data?.media ?? [])
    .find((asset) => asset.assetId === questionResult.data.mediaAssetId);
  if (!media) {
    return NextResponse.json(
      { detail: "The published game media is unavailable in the active public release." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      questionId: questionResult.data.questionId,
      imageUrl: publicMediaUrl(media.objectKey),
      imageAlt: locale === "zh" ? "待猜熊猫的公开照片" : "Published panda photo to identify",
      difficulty: questionResult.data.difficulty,
      options: options.map(({ pandaId, name }) => ({ pandaId, name })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
