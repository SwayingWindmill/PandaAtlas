import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "../../../platform/auth/public.decorator.js";
import { POPULARITY_PORT, type PopularityApplication } from "../application/popularity.application.js";
import { PopularPandasDto } from "./popularity.dto.js";

@ApiTags("Popularity")
@Controller("popular-pandas")
export class PopularityController {
  public constructor(@Inject(POPULARITY_PORT) private readonly popularity: PopularityApplication) {}

  @Get()
  @Public()
  @ApiOperation({
    operationId: "listPopularPandas",
    summary: "大家常看: published pandas most fans began following in the last 30 days, at least five fans each",
  })
  @ApiOkResponse({ type: PopularPandasDto })
  public list() {
    return this.popularity.popular();
  }
}
