import { Controller, DefaultValuePipe, Get, Inject, ParseIntPipe, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../platform/auth/public.decorator.js";
import { PUBLIC_UPDATES_CACHE_TAG } from "../../../platform/http/public-cache.constants.js";
import { PublicCache } from "../../../platform/http/public-cache.decorator.js";
import { UPDATES_PORT, type UpdatesPort } from "../application/updates.application.js";
import { UpdateItemDto } from "./updates.dto.js";

@ApiTags("Updates")
@Controller("updates")
export class UpdatesController {
  public constructor(@Inject(UPDATES_PORT) private readonly updates: UpdatesPort) {}

  @Get()
  @Public()
  @PublicCache({ maxAgeSeconds: 30, staleWhileRevalidateSeconds: 15, tags: [PUBLIC_UPDATES_CACHE_TAG] })
  @ApiOperation({ operationId: "listUpdates", summary: "List asynchronously projected publication updates" })
  @ApiQuery({ name: "limit", required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiOkResponse({ type: UpdateItemDto, isArray: true })
  public list(@Query("limit", new DefaultValuePipe(30), ParseIntPipe) limit: number) {
    return this.updates.list(limit);
  }
}
