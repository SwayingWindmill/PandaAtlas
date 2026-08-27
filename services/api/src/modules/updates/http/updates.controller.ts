import { Controller, DefaultValuePipe, Get, Inject, ParseIntPipe, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../platform/auth/public.decorator.js";
import { UPDATES_PORT, type UpdatesPort } from "../application/updates.application.js";
import { UpdateItemDto } from "./updates.dto.js";

@ApiTags("Updates")
@Controller("updates")
export class UpdatesController {
  public constructor(@Inject(UPDATES_PORT) private readonly updates: UpdatesPort) {}

  @Get()
  @Public()
  @ApiOperation({ operationId: "listUpdates", summary: "List asynchronously projected publication updates" })
  @ApiQuery({ name: "limit", required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiOkResponse({ type: UpdateItemDto, isArray: true })
  public list(@Query("limit", new DefaultValuePipe(30), ParseIntPipe) limit: number) {
    return this.updates.list(limit);
  }
}
