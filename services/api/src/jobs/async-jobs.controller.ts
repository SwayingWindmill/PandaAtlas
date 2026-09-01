import { Controller, Get, Req, VERSION_NEUTRAL, Version } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { Public } from "../platform/auth/public.decorator.js";
import { AppConfig } from "../platform/config/app-config.js";
import { ProblemException } from "../platform/http/problem.exception.js";
import { AsyncDownstreamRunnerService } from "./async-downstream-runner.service.js";

@ApiExcludeController()
@Controller("internal/jobs")
export class AsyncJobsController {
  public constructor(
    private readonly config: AppConfig,
    private readonly runner: AsyncDownstreamRunnerService,
  ) {}

  @Get("async-downstream")
  @Version(VERSION_NEUTRAL)
  @Public()
  public run(@Req() request: FastifyRequest) {
    this.assertCronAuthorization(request.headers.authorization);
    return this.runner.runCycle();
  }

  private assertCronAuthorization(authorization: string | undefined): void {
    const expectedValue = this.config.cronSecret;
    if (expectedValue === undefined || authorization === undefined) {
      throw new ProblemException(401, "auth.unauthorized", "Cron authorization is required.");
    }
    const [scheme, providedValue] = authorization.split(" ", 2);
    if (scheme?.toLowerCase() !== "bearer" || providedValue === undefined) {
      throw new ProblemException(401, "auth.unauthorized", "Cron authorization is invalid.");
    }
    const provided = Buffer.from(providedValue, "utf8");
    const expected = Buffer.from(expectedValue, "utf8");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new ProblemException(401, "auth.unauthorized", "Cron authorization is invalid.");
    }
  }
}
