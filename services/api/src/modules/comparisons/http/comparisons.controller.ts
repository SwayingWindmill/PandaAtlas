import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../platform/auth/public.decorator.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { ComparisonCatalogError } from "../application/comparison-catalog.js";
import { COMPARISONS_PORT, type ComparisonsApplication } from "../application/comparisons.application.js";
import { ComparisonsDto } from "./comparisons.dto.js";

@ApiTags("Comparisons")
@Controller("comparisons")
export class ComparisonsController {
  public constructor(@Inject(COMPARISONS_PORT) private readonly comparisons: ComparisonsApplication) {}

  @Get()
  @Public()
  @ApiOperation({
    operationId: "listComparisons",
    summary: "Published 比一比: pairs of pandas the team compares side by side, newest first",
  })
  @ApiOkResponse({ type: ComparisonsDto })
  @ApiServiceUnavailableResponse({ description: "The stored comparison catalog is invalid." })
  public async list() {
    try {
      return await this.comparisons.published();
    } catch (error) {
      if (error instanceof ComparisonCatalogError) {
        throw new ProblemException(503, "comparisons.unavailable", "Comparisons are not available.");
      }
      throw error;
    }
  }
}
