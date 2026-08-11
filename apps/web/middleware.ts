import { NextResponse, type NextRequest } from "next/server";
import { TRUSTED_PANDA_REFERENCES } from "@/lib/generated/trusted-identity-aliases";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";

function decodePathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function redirectToCanonicalRoute(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const preferredLocale = resolvePreferredPublicLocale(request.headers.get("accept-language"));
  const redirect = (destinationPath: string) => {
    const destination = request.nextUrl.clone();
    destination.pathname = destinationPath;
    return NextResponse.redirect(destination, 308);
  };

  if (pathname === "/") return redirect(`/${preferredLocale}`);
  if (pathname === "/pandas" || pathname === "/atlas") return redirect(`/${preferredLocale}/pandas`);
  if (pathname === "/me" || pathname === "/me/passport" || pathname === "/my-pandas") {
    return redirect(`/${preferredLocale}/me`);
  }
  if (pathname === "/contribute") return redirect(`/${preferredLocale}/contribute`);
  if (pathname === "/me/submissions") {
    return redirect(`/${preferredLocale}/me/submissions`);
  }
  const unlocalizedSubmission = pathname.match(
    /^\/me\/submissions\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/,
  );
  if (unlocalizedSubmission) {
    return redirect(`/${preferredLocale}/me/submissions/${unlocalizedSubmission[1]}`);
  }

  const localizedCollection = pathname.match(/^\/(zh|en)\/atlas$/);
  if (localizedCollection) return redirect(`/${localizedCollection[1]}/pandas`);

  const localizedPassportAlias = pathname.match(/^\/(zh|en)\/my-pandas$/);
  if (localizedPassportAlias) return redirect(`/${localizedPassportAlias[1]}/me`);

  const unlocalizedProfile = pathname.match(/^\/(?:atlas|pandas)\/([^/]+)$/);
  if (unlocalizedProfile) {
    const decodedSlug = decodePathSegment(unlocalizedProfile[1]);
    if (!decodedSlug) return null;
    const reference = TRUSTED_PANDA_REFERENCES[decodedSlug];
    if (!reference) return null;
    return redirect(`/${preferredLocale}/pandas/${reference.slug}`);
  }

  const localizedProfile = pathname.match(/^\/(zh|en)\/(atlas|pandas)\/([^/]+)$/);
  if (localizedProfile) {
    const [, locale, family, rawSlug] = localizedProfile;
    const decodedSlug = decodePathSegment(rawSlug);
    if (!decodedSlug) return null;
    const reference = TRUSTED_PANDA_REFERENCES[decodedSlug];
    if (!reference) return null;
    if (family === "atlas" || reference.slug !== decodedSlug) {
      return redirect(`/${locale}/pandas/${reference.slug}`);
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const redirect = redirectToCanonicalRoute(request);
  if (redirect) return redirect;
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;
  const language = pathname === "/en" || pathname.startsWith("/en/") ? "en" : "zh-CN";
  requestHeaders.set("x-panda-page-language", language);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const refreshedResponse = await refreshSupabaseSession(request, response);
  const isPrivateContributionPath =
    /^\/(zh|en)\/contribute$/.test(pathname) ||
    /^\/(zh|en)\/me\/submissions(?:\/|$)/.test(pathname);
  if (isPrivateContributionPath) {
    refreshedResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, private, max-age=0, must-revalidate",
    );
    refreshedResponse.headers.set("Pragma", "no-cache");
    refreshedResponse.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    refreshedResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, private, max-age=0, must-revalidate",
    );
    refreshedResponse.headers.set("Pragma", "no-cache");
    refreshedResponse.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }
  return refreshedResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
