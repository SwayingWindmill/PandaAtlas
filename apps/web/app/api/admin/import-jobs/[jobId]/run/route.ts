import { proxyAdminRequest } from "@/app/api/admin/_shared";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  return proxyAdminRequest(`/api/v1/admin/import-jobs/${jobId}/run`, "POST", request);
}
