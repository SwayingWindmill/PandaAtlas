import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export interface OpsAlertContextInput {
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface OpsAlertBindingsInput {
  OPS_ALERT_WEBHOOK_URL?: unknown;
  OPS_ALERT_WEBHOOK_FORMAT?: unknown;
}

export interface OpsAlertRuntimeState {
  waitUntil: ((promise: Promise<unknown>) => void) | undefined;
  webhookUrl: unknown;
  webhookFormat: unknown;
}

/** Holds Cloudflare execution context (`waitUntil`) and runtime webhook secrets for the active invocation. */
@Injectable()
export class OpsAlertRuntimeService {
  private readonly states = new AsyncLocalStorage<OpsAlertRuntimeState>();

  public withContext<T>(
    context: OpsAlertContextInput | undefined,
    bindings: OpsAlertBindingsInput | undefined,
    work: () => T,
  ): T {
    const waitUntil =
      typeof context?.waitUntil === "function"
        ? (promise: Promise<unknown>) => {
            // Preserve the Cloudflare ExecutionContext receiver when scheduling background delivery.
            context.waitUntil!(promise);
          }
        : undefined;
    return this.states.run(
      {
        waitUntil,
        webhookUrl: bindings?.OPS_ALERT_WEBHOOK_URL,
        webhookFormat: bindings?.OPS_ALERT_WEBHOOK_FORMAT,
      },
      work,
    );
  }

  public current(): OpsAlertRuntimeState | undefined {
    return this.states.getStore();
  }
}
