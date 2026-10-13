import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
  Version,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";
import { AsyncDownstreamHeartbeat } from "../integration/async-downstream-heartbeat.js";
import { READINESS_PROBE, type ReadinessProbe } from "./readiness.js";

// The Cron Trigger runs every five minutes, so four missed cycles mean async downstream has stalled.
const ASYNC_DOWNSTREAM_STALL_SECONDS = 20 * 60;

@Public()
@Controller()
export class HealthController {
  public constructor(
    @Inject(READINESS_PROBE) private readonly readiness: ReadinessProbe,
    private readonly heartbeat: AsyncDownstreamHeartbeat,
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

  // Probed externally (#560): unhealthy once no async downstream cycle has completed for too long.
  @Get("health/async")
  @Version(VERSION_NEUTRAL)
  public async asyncDownstreamHealth(): Promise<{ status: "ok" }> {
    let seconds: number;
    try {
      seconds = await this.heartbeat.secondsSinceSuccess();
    } catch (cause) {
      throw new ServiceUnavailableException("A required dependency is unavailable", { cause });
    }
    if (seconds > ASYNC_DOWNSTREAM_STALL_SECONDS) {
      const cause = new Error(`The last async downstream cycle completed ${seconds}s ago`);
      throw new ServiceUnavailableException("Async downstream work is stalled", { cause });
    }
    return { status: "ok" };
  }
}
