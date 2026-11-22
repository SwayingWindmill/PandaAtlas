import { Inject, Injectable, Optional } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  RATE_LIMIT_OVERRIDE,
  type RateLimitRuntimeOptions,
  type RateLimitRuntimeState,
  type RateLimitWorkerBindings,
} from "./rate-limit.types.js";

/** Holds Cloudflare Rate Limiting bindings for the active Worker request. */
@Injectable()
export class RateLimitRuntimeService {
  private readonly requests = new AsyncLocalStorage<RateLimitRuntimeState>();

  public constructor(
    @Optional() @Inject(RATE_LIMIT_OVERRIDE) private readonly override?: RateLimitRuntimeState,
  ) {}

  public withBindings<T>(
    bindings: RateLimitWorkerBindings,
    work: () => T,
    options?: RateLimitRuntimeOptions,
  ): T {
    return this.requests.run(
      { ...bindings, trustedWebClientIp: options?.trustedWebClientIp },
      work,
    );
  }

  public current(): RateLimitRuntimeState | undefined {
    const active = this.requests.getStore();
    if (this.override === undefined) return active;
    return { ...active, ...this.override };
  }

  public isTrustedWebClientIp(): boolean {
    return this.current()?.trustedWebClientIp === true;
  }
}
