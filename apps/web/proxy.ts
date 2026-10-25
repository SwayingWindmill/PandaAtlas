import { NextResponse, type NextRequest } from "next/server";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";
import { isAdminPath, isAdminShellEnabled } from "@/lib/server/admin-shell";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";

// Unlocalized paths, including retired aliases, and the localized route each one now lives at.
const UNLOCALIZED_ROUTES = new Map([
  ["/", ""],
  ["/pandas", "/pandas"],
  ["/atlas", "/pandas"],
  ["/me", "/me"],
  ["/me/passport", "/me"],
  ["/my-pandas", "/me"],
  ["/map", "/map"],
  ["/global-distribution", "/map"],
  ["/contribute", "/contribute"],
  ["/me/submissions", "/me/submissions"],
]);

function redirectToCanonicalRoute(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const preferredLocale = resolvePreferredPublicLocale(request.headers.get("accept-language"));
  const redirect = (destinationPath: string) => {
    const destination = request.nextUrl.clone();
    destination.pathname = destinationPath;
    return NextResponse.redirect(destination, 308);
  };

  const localizedRoute = UNLOCALIZED_ROUTES.get(pathname);
  if (localizedRoute !== undefined) return redirect(`/${preferredLocale}${localizedRoute}`);
  const unlocalizedSubmission = pathname.match(
    /^\/me\/submissions\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/,
  );
  if (unlocalizedSubmission) {
    return redirect(`/${preferredLocale}/me/submissions/${unlocalizedSubmission[1]}`);
  }

  const localizedCollection = pathname.match(/^\/(zh|en)\/atlas$/);
  if (localizedCollection) return redirect(`/${localizedCollection[1]}/pandas`);

  // The rotating gallery was retired; the panda list is the one way to browse.
  const retiredDiscovery = pathname.match(/^\/(zh|en)\/pandas\/discover$/);
  if (retiredDiscovery) return redirect(`/${retiredDiscovery[1]}/pandas`);

  const localizedPassportAlias = pathname.match(/^\/(zh|en)\/(?:my-pandas|me\/passport)$/);
  if (localizedPassportAlias) return redirect(`/${localizedPassportAlias[1]}/me`);

  // Localized pages resolve legacy slugs through the API, or return 404.
  const unlocalizedProfile = pathname.match(/^\/(?:atlas|pandas)\/([^/]+)$/);
  if (unlocalizedProfile) return redirect(`/${preferredLocale}/pandas/${unlocalizedProfile[1]}`);

  const localizedAtlasProfile = pathname.match(/^\/(zh|en)\/atlas\/([^/]+)$/);
  if (localizedAtlasProfile) return redirect(`/${localizedAtlasProfile[1]}/pandas/${localizedAtlasProfile[2]}`);

  const unlocalizedEntity = pathname.match(/^\/(places|institutions)\/([^/]+)$/);
  if (unlocalizedEntity) return redirect(`/${preferredLocale}/${unlocalizedEntity[1]}/${unlocalizedEntity[2]}`);
  return null;
}

export async function proxy(request: NextRequest) {
  if (isAdminPath(request.nextUrl.pathname) && !isAdminShellEnabled()) {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store, private" } });
  }
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
  if (isAdminPath(pathname)) {
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
