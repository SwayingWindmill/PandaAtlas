import { NextResponse, type NextRequest } from "next/server";
import { TRUSTED_PANDA_REFERENCES } from "@/lib/generated/trusted-identity-aliases";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";

function decodePathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function redirectToLocalizedPublicRoute(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const locale = resolvePreferredPublicLocale(request.headers.get("accept-language"));

  if (pathname === "/") {
    const destination = request.nextUrl.clone();
    destination.pathname = `/${locale}`;
    return NextResponse.redirect(destination, 308);
  }

  if (pathname === "/atlas") {
    const destination = request.nextUrl.clone();
    destination.pathname = `/${locale}/atlas`;
    return NextResponse.redirect(destination, 308);
  }

  const legacyProfileMatch = pathname.match(/^\/atlas\/([^/]+)$/);
  if (legacyProfileMatch) {
    const decodedSlug = decodePathSegment(legacyProfileMatch[1]);
    if (!decodedSlug) return null;
    const reference = TRUSTED_PANDA_REFERENCES[decodedSlug];
    if (!reference) return null;
    const destination = request.nextUrl.clone();
    destination.pathname = `/${locale}/atlas/${reference.slug}`;
    return NextResponse.redirect(destination, 308);
  }

  const localizedProfileMatch = pathname.match(/^\/(zh|en)\/atlas\/([^/]+)$/);
  if (localizedProfileMatch) {
    const [, routeLocale, rawSlug] = localizedProfileMatch;
    const decodedSlug = decodePathSegment(rawSlug);
    if (!decodedSlug) return null;
    const reference = TRUSTED_PANDA_REFERENCES[decodedSlug];
    if (reference && reference.slug !== decodedSlug) {
      const destination = request.nextUrl.clone();
      destination.pathname = `/${routeLocale}/atlas/${reference.slug}`;
      return NextResponse.redirect(destination, 308);
    }
  }

  return null;
}

export function middleware(request: NextRequest) {
  const redirect = redirectToLocalizedPublicRoute(request);
  if (redirect) return redirect;

  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;
  const language = pathname === "/en" || pathname.startsWith("/en/") ? "en" : "zh-CN";

  requestHeaders.set("x-panda-page-language", language);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
