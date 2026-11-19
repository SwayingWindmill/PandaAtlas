import { NextRequest, NextResponse } from "next/server";

import { loadSiteNavigation } from "@/features/site-shell/site-navigation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "zh";
  const navigation = await loadSiteNavigation(locale);
  return NextResponse.json(navigation, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
