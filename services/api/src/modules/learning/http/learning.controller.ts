import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../platform/auth/public.decorator.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { LearningCatalogError } from "../application/learning-catalog.js";
import { LEARNING_PORT, type LearningApplication } from "../application/learning.application.js";
import { LearningCatalogDto } from "./learning.dto.js";

@ApiTags("Learning")
@Controller("learning")
export class LearningController {
  public constructor(@Inject(LEARNING_PORT) private readonly learning: LearningApplication) {}

  @Get()
  @Public()
  @ApiOperation({
    operationId: "getLearningCatalog",
    summary: "Published 科普 articles, terms, face guides, face challenges and month themes",
  })
  @ApiOkResponse({ type: LearningCatalogDto })
  @ApiServiceUnavailableResponse({ description: "The stored learning catalog is missing or invalid." })
  public async getCatalog() {
    try {
      return await this.learning.published();
    } catch (error) {
      if (error instanceof LearningCatalogError) {
        throw new ProblemException(503, "learning.unavailable", "Learning content is not available.");
      }
      throw error;
    }
  }
}
