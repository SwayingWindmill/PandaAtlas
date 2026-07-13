import { proxyAdminRequest } from "@/app/api/admin/_shared";

export async function POST(request: Request) {
  return proxyAdminRequest(request, "/api/v1/admin/import-jobs", "POST");
}
