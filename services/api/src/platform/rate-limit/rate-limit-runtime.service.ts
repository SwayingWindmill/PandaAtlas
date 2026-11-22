import { Inject, Injectable, Optional } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
import { RATE_LIMIT_OVERRIDE, type RateLimitWorkerBindings } from "./rate-limit.types.js";

/** Holds Cloudflare Rate Limiting bindings for the active Worker request. */
@Injectable()
export class RateLimitRuntimeService {
  private readonly requests = new AsyncLocalStorage<RateLimitWorkerBindings>();

  public constructor(
    @Optional() @Inject(RATE_LIMIT_OVERRIDE) private readonly override?: RateLimitWorkerBindings,
  ) {}

  public withBindings<T>(bindings: RateLimitWorkerBindings, work: () => T): T {
    return this.requests.run(bindings, work);
  }

  public current(): RateLimitWorkerBindings | undefined {
    const active = this.requests.getStore();
    if (this.override === undefined) return active;
    return { ...active, ...this.override };
  }
}
