import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
  Version,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";
import { READINESS_PROBE, type ReadinessProbe } from "./readiness.js";

@Public()
@Controller()
export class HealthController {
  public constructor(@Inject(READINESS_PROBE) private readonly readiness: ReadinessProbe) {}

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
    } catch {
      throw new ServiceUnavailableException("A required dependency is unavailable");
    }
    return { status: "ok" };
  }
}
