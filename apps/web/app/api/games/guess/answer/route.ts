import { NextRequest } from "next/server";

import { proxyPublicGameRequest } from "@/lib/server/fastapi-public-games-proxy";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return proxyPublicGameRequest(request, "answer");
}
