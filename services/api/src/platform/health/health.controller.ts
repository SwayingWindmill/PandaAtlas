import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
  Version,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";
import { AsyncDownstreamHealth } from "./async-downstream-health.js";
import { READINESS_PROBE, type ReadinessProbe } from "./readiness.js";

@Public()
@Controller()
export class HealthController {
  public constructor(
    @Inject(READINESS_PROBE) private readonly readiness: ReadinessProbe,
    private readonly asyncDownstream: AsyncDownstreamHealth,
  ) {}

  @Get("health")
  @Version(VERSION_NEUTRAL)
  public health(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("ready")
  @Version(VERSION_NEUTRAL)
  public async ready(): Promise<{ status: "ok" }> {
    try {
      await this.readiness.check();
    } catch (cause) {
      throw new ServiceUnavailableException("A required dependency is unavailable", { cause });
    }
    return { status: "ok" };
  }

  // Probed externally: unhealthy when due async work has waited past the stall threshold.
  @Get("health/async")
  @Version(VERSION_NEUTRAL)
  public async asyncDownstreamHealth(): Promise<{ status: "ok" }> {
    try {
      await this.asyncDownstream.check();
    } catch (cause) {
      throw new ServiceUnavailableException("Async downstream work is stalled or unavailable", { cause });
    }
    return { status: "ok" };
  }
}
