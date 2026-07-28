import { proxyFastApiSession } from "@/lib/server/fastapi-session-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return proxyFastApiSession("/api/v1/admin/session");
}
