import { Body, Controller, HttpCode, Post, UseGuards, VERSION_NEUTRAL } from "@nestjs/common";
import { Public } from "../platform/auth/public.decorator.js";
import { ExpireRecentAuthDto, RunScheduledCyclesDto, TakeDownAndRestoreDto } from "./e2e-fixture.dto.js";
import { E2eFixtureGuard } from "./e2e-fixture.guard.js";
import { E2eFixtureService, type MobileJourneySeedResult } from "./e2e-fixture.service.js";

@Public()
@UseGuards(E2eFixtureGuard)
@Controller({ path: "_test/e2e", version: VERSION_NEUTRAL })
export class E2eFixtureController {
  public constructor(private readonly fixtures: E2eFixtureService) {}

  @Post("seed")
  @HttpCode(200)
  public seed(): Promise<MobileJourneySeedResult> {
    return this.fixtures.seedMobileJourneys();
  }

  @Post("scheduled-cycles")
  @HttpCode(200)
  public runScheduledCycles(@Body() body: RunScheduledCyclesDto): Promise<{ cycles: number }> {
    return this.fixtures.runScheduledCycles(body.cycles);
  }

  @Post("takedown-restore")
  @HttpCode(200)
  public takeDownAndRestore(
    @Body() body: TakeDownAndRestoreDto,
  ): Promise<{ pandaId: string; cycles: number }> {
    return this.fixtures.takeDownAndRestore(body.pandaId);
  }

  @Post("auth/expire-recent")
  @HttpCode(200)
  public expireRecentAuth(
    @Body() body: ExpireRecentAuthDto,
  ): { accountId: string; cutoffMs: number } {
    return this.fixtures.expireRecentAuth(body.accountId, body.afterEpochSeconds);
  }
}
