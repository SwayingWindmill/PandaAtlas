import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../platform/auth/public.decorator.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { OverseasStatusCatalogError } from "../application/overseas-status-catalog.js";
import { OVERSEAS_STATUS_PORT, type OverseasStatusApplication } from "../application/overseas-status.application.js";
import { OverseasStatusDto } from "./overseas-status.dto.js";

@ApiTags("Overseas status")
@Controller("overseas-status")
export class OverseasStatusController {
  public constructor(@Inject(OVERSEAS_STATUS_PORT) private readonly status: OverseasStatusApplication) {}

  @Get()
  @Public()
  @ApiOperation({
    operationId: "listOverseasStatus",
    summary: "Published 海外大熊猫状态: location, announced return and quarantine stage, each with its source",
  })
  @ApiOkResponse({ type: OverseasStatusDto })
  @ApiServiceUnavailableResponse({ description: "The stored overseas status catalog is invalid." })
  public async list() {
    try {
      return await this.status.published();
    } catch (error) {
      if (error instanceof OverseasStatusCatalogError) {
        throw new ProblemException(503, "overseas_status.unavailable", "Overseas status is not available.");
      }
      throw error;
    }
  }
}
