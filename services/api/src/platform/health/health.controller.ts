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
import { IntegrationDeadLetters } from "../integration/integration-dead-letters.js";
import { READINESS_PROBE, type ReadinessProbe } from "./readiness.js";

// The Cron Trigger runs every fifteen minutes, so four missed cycles mean async downstream has stalled.
const ASYNC_DOWNSTREAM_STALL_SECONDS = 60 * 60;

@Public()
@Controller()
export class HealthController {
  public constructor(
    @Inject(READINESS_PROBE) private readonly readiness: ReadinessProbe,
    private readonly heartbeat: AsyncDownstreamHeartbeat,
    private readonly deadLetters: IntegrationDeadLetters,
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

  // Probed externally (#560): unhealthy once no async downstream cycle has completed for too long, or
  // while a dead-lettered message waits for an operator (#629).
  @Get("health/async")
  @Version(VERSION_NEUTRAL)
  public async asyncDownstreamHealth(): Promise<{ status: "ok" }> {
    let seconds: number;
    let deadLetters: number;
    try {
      [seconds, deadLetters] = await Promise.all([this.heartbeat.secondsSinceSuccess(), this.deadLetters.count()]);
    } catch (cause) {
      throw new ServiceUnavailableException("A required dependency is unavailable", { cause });
    }
    if (seconds > ASYNC_DOWNSTREAM_STALL_SECONDS) {
      const cause = new Error(`The last async downstream cycle completed ${seconds}s ago`);
      throw new ServiceUnavailableException("Async downstream work is stalled", { cause });
    }
    if (deadLetters > 0) {
      const cause = new Error(`${deadLetters} dead-lettered integration messages await an operator`);
      throw new ServiceUnavailableException("Async downstream has dead-lettered messages", { cause });
    }
    return { status: "ok" };
  }
}
