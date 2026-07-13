import { proxyAdminRequest } from "@/app/api/admin/_shared";

export async function GET(request: Request) {
  return proxyAdminRequest(request, "/api/v1/admin/import-sources", "GET");
}
