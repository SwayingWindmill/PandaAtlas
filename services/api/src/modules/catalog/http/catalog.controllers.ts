import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../platform/auth/public.decorator.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { ComparisonCatalogError, publishedComparisons } from "../application/comparison-catalog.js";
import { LearningCatalogError, publishedCatalog } from "../application/learning-catalog.js";
import { OverseasStatusCatalogError, publishedOverseasStatus } from "../application/overseas-status-catalog.js";
import { VenueNewsCatalogError, publishedVenueNews } from "../application/venue-news-catalog.js";
import { PostgresJsonCatalogStore } from "../infrastructure/postgres-json-catalog.store.js";
import { ComparisonsDto } from "./comparisons.dto.js";
import { LearningCatalogDto } from "./learning.dto.js";
import { OverseasStatusDto } from "./overseas-status.dto.js";
import { VenueNewsDto } from "./venue-news.dto.js";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@ApiTags("Comparisons")
@Controller("comparisons")
export class ComparisonsController {
  public constructor(@Inject(PostgresJsonCatalogStore) private readonly catalogs: PostgresJsonCatalogStore) {}

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
      return publishedComparisons(await this.catalogs.current("place.comparison_catalog"));
    } catch (error) {
      if (error instanceof ComparisonCatalogError) {
        throw new ProblemException(503, "comparisons.unavailable", "Comparisons are not available.");
      }
      throw error;
    }
  }
}

@ApiTags("Learning")
@Controller("learning")
export class LearningController {
  public constructor(@Inject(PostgresJsonCatalogStore) private readonly catalogs: PostgresJsonCatalogStore) {}

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
      return publishedCatalog(await this.catalogs.current("learning.catalog"));
    } catch (error) {
      if (error instanceof LearningCatalogError) {
        throw new ProblemException(503, "learning.unavailable", "Learning content is not available.");
      }
      throw error;
    }
  }
}

@ApiTags("Overseas status")
@Controller("overseas-status")
export class OverseasStatusController {
  public constructor(@Inject(PostgresJsonCatalogStore) private readonly catalogs: PostgresJsonCatalogStore) {}

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
      return publishedOverseasStatus(await this.catalogs.current("place.overseas_status_catalog"));
    } catch (error) {
      if (error instanceof OverseasStatusCatalogError) {
        throw new ProblemException(503, "overseas_status.unavailable", "Overseas status is not available.");
      }
      throw error;
    }
  }
}

@ApiTags("Venue news")
@Controller("venue-news")
export class VenueNewsController {
  public constructor(@Inject(PostgresJsonCatalogStore) private readonly catalogs: PostgresJsonCatalogStore) {}

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
      return publishedVenueNews(await this.catalogs.current("place.venue_news_catalog"), institution);
    } catch (error) {
      if (error instanceof VenueNewsCatalogError) {
        throw new ProblemException(503, "venue_news.unavailable", "Venue news is not available.");
      }
      throw error;
    }
  }
}
