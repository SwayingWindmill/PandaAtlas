import { NextResponse } from "next/server";

import {
  callFastApiCommunityIntake,
  communityIntakeJsonResponse,
  isCommunityNextResponse,
} from "@/lib/server/fastapi-community-intake-proxy";

export const dynamic = "force-dynamic";

const ALLOWED_COMMANDS = new Set([
  "save-draft",
  "submit",
  "respond-information-request",
  "withdraw",
  "prepare-attachment",
]);

interface CommandRouteContext {
  params: Promise<{ submissionId: string; command: string }>;
}

export async function POST(request: Request, context: CommandRouteContext): Promise<NextResponse> {
  const { submissionId, command } = await context.params;
  if (!ALLOWED_COMMANDS.has(command)) {
    return NextResponse.json({ detail: "Unknown contribution command" }, { status: 404 });
  }
  const ifMatch = request.headers.get("if-match");
  if (!ifMatch) {
    return NextResponse.json({ detail: "If-Match header is required" }, { status: 428 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const result = await callFastApiCommunityIntake(
    `/api/v1/me/submissions/${encodeURIComponent(submissionId)}/commands/${command}`,
    {
      method: "POST",
      body,
      headers: { "If-Match": ifMatch },
    },
  );
  return isCommunityNextResponse(result) ? result : communityIntakeJsonResponse(result);
}
