import { NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  const [favorites, contributions] = await Promise.all([
    api.client.GET("/api/v2/me/favorites", { headers: api.headers }),
    api.client.GET("/api/v2/me/contributions", { headers: api.headers }),
  ]);
  if (!favorites.data) return v2JsonResponse(favorites);
  if (!contributions.data) return v2JsonResponse(contributions);

  const contributionCounts = new Map<string, number>();
  for (const contribution of contributions.data.items) {
    contributionCounts.set(
      contribution.targetPandaId,
      (contributionCounts.get(contribution.targetPandaId) ?? 0) + 1,
    );
  }
  const favoriteIds = new Set(favorites.data.items.map((favorite) => favorite.pandaId));
  const pandaIds = new Set([...favoriteIds, ...contributionCounts.keys()]);
  const favoriteById = new Map(favorites.data.items.map((favorite) => [favorite.pandaId, favorite]));

  return NextResponse.json(
    {
      entries: [...pandaIds].map((pandaId) => ({
        panda_id: pandaId,
        relationship_state: favoriteIds.has(pandaId) ? "active" : null,
        first_followed_at: favoriteById.get(pandaId)?.favoritedAt ?? null,
        contribution_count: contributionCounts.get(pandaId) ?? 0,
      })),
    },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
