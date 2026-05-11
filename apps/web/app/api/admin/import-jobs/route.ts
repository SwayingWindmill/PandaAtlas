import { proxyAdminRequest } from "@/app/api/admin/_shared";

export async function POST(request: Request) {
  return proxyAdminRequest("/api/v1/admin/import-jobs", "POST", request);
}
