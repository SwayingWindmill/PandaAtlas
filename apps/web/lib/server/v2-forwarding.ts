import type { paths } from "@zhipanda/api-client";

type ApiPath = keyof paths & string;
type ApiMethod<P extends ApiPath> = Uppercase<
  {
    [M in Exclude<keyof paths[P], "parameters">]-?: paths[P][M] extends undefined ? never : M & string;
  }[Exclude<keyof paths[P], "parameters">]
>;

interface ForwardedRoute {
  methods: readonly string[];
  web: readonly string[];
  api: string;
}

// A Web path the browser calls, and the API operation it forwards to. The API path is typed against
// the generated client, so a path or method the API does not serve fails the build. Web parameters
// (`:name`) fill the API placeholders (`{name}`) in order.
function route<P extends ApiPath>(web: string, api: P, ...methods: ApiMethod<P>[]): ForwardedRoute {
  return { methods, web: web.split("/").filter(Boolean), api };
}

// The first matching entry wins, so a literal segment is listed before a parameter at the same place.
const ROUTES: readonly ForwardedRoute[] = [
  route("/api/admin/session", "/api/v2/me", "GET"),
  route("/api/identity/session", "/api/v2/me", "GET"),
  route("/api/admin/audit/evidence", "/api/v2/audit/evidence", "GET"),
  route("/api/admin/publication/releases", "/api/v2/publication/releases", "GET", "POST"),
  route("/api/admin/publication/releases/:releaseId", "/api/v2/publication/releases/{releaseId}/inspection", "GET"),
  route("/api/admin/review/cases", "/api/v2/review/cases", "GET", "POST"),
  route("/api/admin/review/cases/:reviewCaseId/surface", "/api/v2/review/cases/{reviewCaseId}/surface", "GET"),
  route("/api/admin/review/cases/:reviewCaseId/claim", "/api/v2/review/cases/{reviewCaseId}/claim", "POST"),
  route(
    "/api/admin/review/cases/:reviewCaseId/source-verifications",
    "/api/v2/review/cases/{reviewCaseId}/source-verifications",
    "POST",
  ),
  route("/api/admin/review/cases/:reviewCaseId/decision", "/api/v2/review/cases/{reviewCaseId}/decision", "POST"),
  route("/api/admin/staff/accounts", "/api/v2/staff/accounts", "GET"),
  route("/api/admin/staff/accounts/catalog", "/api/v2/staff/accounts/catalog", "GET"),
  route("/api/admin/staff/accounts/:accountId", "/api/v2/staff/accounts/{accountId}", "GET"),
  route("/api/admin/staff/accounts/:accountId/roles", "/api/v2/staff/accounts/{accountId}/roles", "POST"),
  route(
    "/api/admin/staff/accounts/:accountId/roles/:assignmentId/revoke",
    "/api/v2/staff/accounts/{accountId}/roles/{assignmentId}/revoke",
    "POST",
  ),
  route("/api/admin/staff/accounts/:accountId/state", "/api/v2/staff/accounts/{accountId}/state", "POST"),
  route("/api/admin/staff/invitations", "/api/v2/staff/invitations", "GET", "POST"),
  route("/api/admin/staff/invitations/accept", "/api/v2/me/staff-invitation/accept", "POST"),
  route("/api/community-intake/submissions", "/api/v2/me/contributions", "GET"),
  route("/api/community-intake/submissions", "/api/v2/contributions", "POST"),
  route("/api/community-intake/submissions/:submissionId", "/api/v2/me/contributions/{submissionId}", "GET"),
  route("/api/engagement/favorites", "/api/v2/me/favorites", "GET"),
  route("/api/engagement/favorites/:pandaId", "/api/v2/me/favorites/{pandaId}", "POST", "DELETE"),
  route("/api/engagement/seen-pandas", "/api/v2/me/seen-pandas", "GET"),
  route("/api/engagement/seen-pandas/:pandaId", "/api/v2/me/seen-pandas/{pandaId}", "GET", "PUT", "DELETE"),
  route("/api/engagement/checkins", "/api/v2/me/checkins", "GET", "POST"),
  route("/api/engagement/checkins/:checkinId", "/api/v2/me/checkins/{checkinId}", "DELETE"),
  route("/api/engagement/collections", "/api/v2/me/collections", "GET", "POST"),
  route("/api/engagement/collections/:collectionId", "/api/v2/me/collections/{collectionId}", "PATCH", "DELETE"),
  route(
    "/api/engagement/collections/:collectionId/pandas/:pandaId",
    "/api/v2/me/collections/{collectionId}/pandas/{pandaId}",
    "POST",
    "DELETE",
  ),
  route("/api/engagement/game-attempts", "/api/v2/me/game-attempts", "GET", "POST"),
  route("/api/notification/preferences", "/api/v2/me/notifications/preferences", "GET", "PUT"),
  route("/api/notification/inbox/read-all", "/api/v2/me/notifications/read-all", "PATCH"),
  route("/api/notification/inbox/:inboxItemId/read", "/api/v2/me/notifications/{messageId}/read", "PATCH"),
];

export interface ForwardingDependencies {
  baseUrl: string;
  transport: (request: Request) => Promise<Response>;
  getAccessToken: () => Promise<string | null>;
}

// Problem Details (RFC 9457) with the API's `code` extension, so the client reads one error shape.
function problem(status: number, code: string, title: string, detail: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ type: "about:blank", title, status, detail, code }), {
    status,
    headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store, private", ...headers },
  });
}

export function sessionRequiredResponse(): Response {
  return problem(401, "web.sessionRequired", "Authentication required", "Authentication is required for this operation.", {
    "WWW-Authenticate": "Bearer",
  });
}

function matchRoute(method: string, pathname: string): string | "unknown" | "method" {
  const segments = pathname.split("/").filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  let pathKnown = false;
  for (const candidate of ROUTES) {
    if (candidate.web.length !== segments.length) continue;
    const parameters: string[] = [];
    const matched = candidate.web.every((pattern, index) => {
      const segment = segments[index]!;
      if (pattern.startsWith(":")) {
        parameters.push(segment);
        return true;
      }
      return pattern === segment;
    });
    if (!matched) continue;
    pathKnown = true;
    if (!candidate.methods.includes(method)) continue;
    return candidate.api.replace(/\{[^}]+\}/gu, () => encodeURIComponent(parameters.shift()!));
  }
  return pathKnown ? "method" : "unknown";
}

// A state-changing request is accepted only from this site. Browsers send Sec-Fetch-Site; older ones
// send Origin; a client that sends neither carries no ambient cookies, so it cannot forge a session.
function crossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site !== "same-origin";
  const origin = request.headers.get("origin");
  return origin !== null && origin !== new URL(request.url).origin;
}

function declaresJsonBody(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

// The rule for every state-changing request the Web app accepts, from the catch-all and from the
// routes that compose operations: from this site only, and a body only as declared JSON.
export function refuseStateChange(request: Request): Response | undefined {
  if (crossSite(request)) {
    return problem(403, "web.crossSite", "Forbidden", "State-changing requests are accepted from this site only.");
  }
  if (request.headers.has("content-type") && !declaresJsonBody(request)) {
    return problem(415, "web.unsupportedMediaType", "Unsupported Media Type", "Request bodies must be JSON.");
  }
  return undefined;
}

// Forwards a browser request to its API operation with the session's bearer token. The query string
// passes through unchanged, and the API rejects parameters its operation does not declare.
export async function forwardToV2(request: Request, dependencies: ForwardingDependencies): Promise<Response> {
  const url = new URL(request.url);
  const apiPath = matchRoute(request.method, url.pathname);
  if (apiPath === "unknown") {
    return problem(404, "web.notForwarded", "Not Found", "No API operation is forwarded at this path.");
  }
  if (apiPath === "method") {
    return problem(405, "web.methodNotAllowed", "Method Not Allowed", "The API operation does not accept this method.");
  }

  const accessToken = await dependencies.getAccessToken();
  if (accessToken === null) return sessionRequiredResponse();

  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-Correlation-Id": crypto.randomUUID(),
  });
  let body: string | undefined;
  if (request.method !== "GET") {
    const refused = refuseStateChange(request);
    if (refused !== undefined) return refused;
    if (declaresJsonBody(request)) {
      body = await request.text();
      headers.set("Content-Type", "application/json");
    }
  }

  const upstream = await dependencies.transport(
    new Request(`${dependencies.baseUrl}${apiPath}${url.search}`, { method: request.method, headers, body }),
  );
  const responseHeaders = new Headers({ "Cache-Control": "no-store, private" });
  for (const name of ["content-type", "www-authenticate"]) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
}
