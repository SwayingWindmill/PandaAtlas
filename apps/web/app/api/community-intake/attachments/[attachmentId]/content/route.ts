import { NextResponse } from "next/server";

import {
  callFastApiCommunityIntake,
  communityIntakeJsonResponse,
  isCommunityNextResponse,
} from "@/lib/server/fastapi-community-intake-proxy";

export const dynamic = "force-dynamic";

interface AttachmentRouteContext {
  params: Promise<{ attachmentId: string }>;
}

export async function POST(request: Request, context: AttachmentRouteContext): Promise<NextResponse> {
  const { attachmentId } = await context.params;
  const ifMatch = request.headers.get("if-match");
  if (!ifMatch) {
    return NextResponse.json({ detail: "If-Match header is required" }, { status: 428 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Invalid multipart body" }, { status: 400 });
  }
  const result = await callFastApiCommunityIntake(
    `/api/v1/me/attachments/${encodeURIComponent(attachmentId)}/content`,
    {
      method: "POST",
      formData,
      headers: { "If-Match": ifMatch },
    },
  );
  return isCommunityNextResponse(result) ? result : communityIntakeJsonResponse(result);
}
