import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../platform/auth/public.decorator.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { VenueNewsCatalogError } from "../application/venue-news-catalog.js";
import { VENUE_NEWS_PORT, type VenueNewsApplication } from "../application/venue-news.application.js";
import { VenueNewsDto } from "./venue-news.dto.js";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@ApiTags("Venue news")
@Controller("venue-news")
export class VenueNewsController {
  public constructor(@Inject(VENUE_NEWS_PORT) private readonly news: VenueNewsApplication) {}

  @Get()
  @Public()
  @ApiOperation({
    operationId: "listVenueNews",
    summary: "Published 场馆动态: neutral facts from institutions' own announcements, each with its source",
  })
  @ApiQuery({ name: "institution", required: false, description: "Institution slug" })
  @ApiOkResponse({ type: VenueNewsDto })
  @ApiServiceUnavailableResponse({ description: "The stored venue news catalog is invalid." })
  public async list(@Query("institution") institution?: string) {
    if (institution !== undefined && !SLUG.test(institution)) {
      throw new ProblemException(400, "venue_news.institution_invalid", "institution must be a slug.");
    }
    try {
      return await this.news.published(institution);
    } catch (error) {
      if (error instanceof VenueNewsCatalogError) {
        throw new ProblemException(503, "venue_news.unavailable", "Venue news is not available.");
      }
      throw error;
    }
  }
}
