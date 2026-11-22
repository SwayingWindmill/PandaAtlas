import { describe, expect, it } from "vitest";

import { DomainError, type DomainErrorKind } from "../src/platform/errors/domain-error.js";
import { ProblemDetailsFilter } from "../src/platform/http/problem-details.filter.js";
import { ProblemException } from "../src/platform/http/problem.exception.js";

function render(
  exception: unknown,
  opsAlert?: { notify: (event: Record<string, unknown>) => Promise<void> },
) {
  const logs: Array<{ level: string; message: string }> = [];
  const headers: Record<string, string> = {};
  let reply: { body: Record<string, unknown>; status: number } | undefined;
  const filter = new ProblemDetailsFilter(
    { current: { requestId: "request-1" } } as never,
    {
      httpAdapter: {
        setHeader: (_response: unknown, name: string, value: string) => {
          headers[name] = value;
        },
        reply: (_response: unknown, body: Record<string, unknown>, status: number) => {
          reply = { body, status };
        },
      },
    } as never,
    { write: (level: string, message: string) => logs.push({ level, message }) } as never,
    opsAlert as never,
  );
  filter.catch(exception, {
    switchToHttp: () => ({ getResponse: () => ({}), getRequest: () => ({ method: "POST", url: "/api/v2/x?y=1" }) }),
  } as never);
  if (reply === undefined) throw new Error("The filter did not reply");
  return { ...reply, headers, logs };
}

describe("ProblemDetailsFilter", () => {
  it.each<[DomainErrorKind, number]>([
    ["invalid", 400],
    ["not_found", 404],
    ["conflict", 409],
    ["forbidden", 403],
    ["unavailable", 503],
  ])("maps a %s domain error to %i with its code and detail", (kind, status) => {
    const rendered = render(new DomainError(kind, "example.rule", "The example rule was broken."));
    expect(rendered.status).toBe(status);
    expect(rendered.body).toMatchObject({
      status,
      code: "example.rule",
      detail: "The example rule was broken.",
      requestId: "request-1",
    });
  });

  it("logs a domain error only when it is a server-side failure", () => {
    expect(render(new DomainError("conflict", "example.rule", "Conflict.")).logs).toEqual([]);
    expect(render(new DomainError("unavailable", "example.down", "Down.")).logs).toEqual([
      { level: "error", message: "Request failed" },
    ]);
  });

  it("renders any other error as a logged 500 without its message", () => {
    const rendered = render(new Error("connection reset by peer"));
    expect(rendered.status).toBe(500);
    expect(rendered.body).toMatchObject({ code: "system.internal", detail: "The service could not complete the request." });
    expect(rendered.logs).toEqual([{ level: "error", message: "Request failed" }]);
  });

  it("writes optional ProblemException headers such as Retry-After onto the response", () => {
    const rendered = render(
      new ProblemException(429, "request.rateLimited", "Too many requests. Try again shortly.", {
        "Retry-After": "60",
      }),
    );
    expect(rendered.status).toBe(429);
    expect(rendered.headers["Retry-After"]).toBe("60");
    expect(rendered.headers["Content-Type"]).toBe("application/problem+json");
    expect(rendered.logs).toEqual([]);
  });

  it("notifies opsAlert with a stripped path and 5-minute dedupe key only on 5xx errors", () => {
    const events: Array<Record<string, unknown>> = [];
    const opsAlert = {
      notify: (event: Record<string, unknown>) => {
        events.push(event);
        return Promise.resolve();
      },
    };

    render(new DomainError("conflict", "example.rule", "Conflict."), opsAlert);
    expect(events).toEqual([]);

    render(new Error("boom"), opsAlert);
    expect(events).toEqual([
      {
        severity: "critical",
        category: "api_5xx",
        title: "API 5xx 错误",
        summary: "POST /api/v2/x (500) [system.internal]",
        dedupeKey: "5xx:POST:/api/v2/x:system.internal",
        cooldownMs: 300_000,
        metadata: {
          method: "POST",
          path: "/api/v2/x",
          status: 500,
          code: "system.internal",
          requestId: "request-1",
          errorName: "Error",
        },
      },
    ]);
  });
});
