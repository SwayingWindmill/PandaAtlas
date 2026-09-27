import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

function authorized(request: Request, expected: string): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const target = Buffer.from(expected);
  return provided.length === target.length && timingSafeEqual(provided, target);
}

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.PUBLIC_REVALIDATION_AUTH?.trim();
  if (!expected) {
    return Response.json(
      { error: "Public revalidation is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!authorized(request, expected)) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  revalidatePath("/[locale]", "layout");
  revalidatePath("/sitemap.xml");

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
