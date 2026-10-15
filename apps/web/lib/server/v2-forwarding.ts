import type { paths } from "@zhipanda/api-client";

type ApiPath = keyof paths & string;
type ApiMethod<P extends ApiPath> = Uppercase<
  { [M in keyof paths[P]]-?: paths[P][M] extends undefined ? never : M & string }[keyof paths[P]]
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

// The Web paths come first in each pair; a literal segment wins over a parameter listed after it.
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

function problem(status: number, title: string, detail: string, headers: Record<string, string> = {}): Response {
  return Response.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Cache-Control": "no-store, private", ...headers } },
  );
}

function matchRoute(method: string, pathname: string): { route: ForwardedRoute; apiPath: string } | "unknown" | "method" {
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
    const apiPath = candidate.api.replace(/\{[^}]+\}/gu, () => encodeURIComponent(parameters.shift()!));
    return { route: candidate, apiPath };
  }
  return pathKnown ? "method" : "unknown";
}

// A state-changing request is accepted only from this site. Browsers send Sec-Fetch-Site; older ones
// send Origin; a client that sends neither carries no ambient cookies, so it cannot forge a session.
function crossSite(request: Request, origin: string): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site !== "same-origin";
  const requestOrigin = request.headers.get("origin");
  return requestOrigin !== null && requestOrigin !== origin;
}

// Forwards a browser request to its API operation with the session's bearer token. Every policy of
// the Web-to-API boundary lives here: the allowlist, the session, the same-origin rule for writes,
// JSON-only bodies, and `no-store` on the way back.
export async function forwardToV2(request: Request, dependencies: ForwardingDependencies): Promise<Response> {
  const url = new URL(request.url);
  const match = matchRoute(request.method, url.pathname);
  if (match === "unknown") return problem(404, "Not Found", "No API operation is forwarded at this path.");
  if (match === "method") return problem(405, "Method Not Allowed", "The API operation does not accept this method.");

  const accessToken = await dependencies.getAccessToken();
  if (accessToken === null) {
    return problem(401, "Authentication required", "Authentication is required for this operation.", {
      "WWW-Authenticate": "Bearer",
    });
  }

  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-Correlation-Id": crypto.randomUUID(),
  });
  let body: string | undefined;
  if (request.method !== "GET") {
    if (crossSite(request, url.origin)) {
      return problem(403, "Forbidden", "State-changing requests are accepted from this site only.");
    }
    if (request.body !== null) {
      if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
        return problem(415, "Unsupported Media Type", "Request bodies must be JSON.");
      }
      body = await request.text();
      headers.set("Content-Type", "application/json");
    }
  }

  const upstream = await dependencies.transport(
    new Request(`${dependencies.baseUrl}${match.apiPath}${url.search}`, { method: request.method, headers, body }),
  );
  const responseHeaders = new Headers({ "Cache-Control": "no-store, private" });
  for (const name of ["content-type", "www-authenticate"]) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
}
