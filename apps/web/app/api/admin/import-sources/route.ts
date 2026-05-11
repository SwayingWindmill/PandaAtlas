import { proxyAdminRequest } from "@/app/api/admin/_shared";

export async function GET() {
  return proxyAdminRequest("/api/v1/admin/import-sources", "GET");
}
