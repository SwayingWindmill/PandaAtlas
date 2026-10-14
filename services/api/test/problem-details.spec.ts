import { describe, expect, it } from "vitest";

import { DomainError, type DomainErrorKind } from "../src/platform/errors/domain-error.js";
import { ProblemDetailsFilter } from "../src/platform/http/problem-details.filter.js";

function render(exception: unknown) {
  const logs: Array<{ level: string; message: string }> = [];
  let reply: { body: Record<string, unknown>; status: number } | undefined;
  const filter = new ProblemDetailsFilter(
    { current: { requestId: "request-1" } } as never,
    {
      httpAdapter: {
        setHeader: () => undefined,
        reply: (_response: unknown, body: Record<string, unknown>, status: number) => {
          reply = { body, status };
        },
      },
    } as never,
    { write: (level: string, message: string) => logs.push({ level, message }) } as never,
  );
  filter.catch(exception, {
    switchToHttp: () => ({ getResponse: () => ({}), getRequest: () => ({ method: "POST", url: "/api/v2/x?y=1" }) }),
  } as never);
  if (reply === undefined) throw new Error("The filter did not reply");
  return { ...reply, logs };
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
});
