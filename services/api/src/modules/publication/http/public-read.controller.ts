import { Controller, Get, Inject, Param } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../../../platform/auth/public.decorator.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import {
  PUBLIC_READ_PORT,
  type PublicReadPort,
  type PublicReadResult,
} from "../application/public-read.application.js";
import {
  PublicEvidenceDetailDto,
  PublicLifeEventListDto,
  PublicLineageListDto,
  PublicPandaDetailDto,
  PublicPandaListDto,
  PublicPlaceDetailDto,
  PublicPlaceListDto,
  PublicReadReleaseDto,
  PublicResidencyListDto,
  PublicStatsResponseDto,
} from "./publication.dto.js";

function publicResult<T>(result: PublicReadResult<T>, notFoundDetail: string): T {
  if (result.kind === "unavailable") {
    throw new ProblemException(
      503,
      "publication.unavailable",
      "No active public release is currently available.",
    );
  }
  if (result.kind === "not_found") {
    throw new ProblemException(404, "publication.resourceNotFound", notFoundDetail);
  }
  return result.value;
}

@ApiTags("Public reads")
@Controller()
export class PublicReadController {
  public constructor(@Inject(PUBLIC_READ_PORT) private readonly publicRead: PublicReadPort) {}

  @Get("release")
  @Public()
  @ApiOperation({ operationId: "getCurrentPublicRelease", summary: "Get the active public release" })
  @ApiOkResponse({ type: PublicReadReleaseDto })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async currentRelease() {
    return publicResult(await this.publicRead.currentRelease(), "The public release does not exist.");
  }

  @Get("pandas")
  @Public()
  @ApiOperation({ operationId: "listPublicPandas", summary: "List pandas from one active release" })
  @ApiOkResponse({ type: PublicPandaListDto })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async listPandas() {
    return publicResult(await this.publicRead.listPandas(), "The public panda collection does not exist.");
  }

  @Get("pandas/:slug")
  @Public()
  @ApiOperation({ operationId: "getPublicPanda", summary: "Get a release-pinned public panda detail" })
  @ApiOkResponse({ type: PublicPandaDetailDto })
  @ApiNotFoundResponse({ description: "The panda is absent or under emergency takedown." })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async getPanda(@Param("slug") slug: string) {
    return publicResult(await this.publicRead.getPanda(slug), "The public panda does not exist.");
  }

  @Get("places")
  @Public()
  @ApiOperation({ operationId: "listPublicPlaces", summary: "List places from one active release" })
  @ApiOkResponse({ type: PublicPlaceListDto })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async listPlaces() {
    return publicResult(await this.publicRead.listPlaces(), "The public place collection does not exist.");
  }

  @Get("places/:slug")
  @Public()
  @ApiOperation({ operationId: "getPublicPlace", summary: "Get one public place from the active release" })
  @ApiOkResponse({ type: PublicPlaceDetailDto })
  @ApiNotFoundResponse({ description: "The place is absent or under emergency takedown." })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async getPlace(@Param("slug") slug: string) {
    return publicResult(await this.publicRead.getPlace(slug), "The public place does not exist.");
  }

  @Get("lineage")
  @Public()
  @ApiOperation({ operationId: "listPublicLineage", summary: "List lineage assertions from one active release" })
  @ApiOkResponse({ type: PublicLineageListDto })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async listLineage() {
    return publicResult(await this.publicRead.listLineage(), "The public lineage collection does not exist.");
  }

  @Get("residencies")
  @Public()
  @ApiOperation({ operationId: "listPublicResidencies", summary: "List panda residencies from one active release" })
  @ApiOkResponse({ type: PublicResidencyListDto })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async listResidencies() {
    return publicResult(await this.publicRead.listResidencies(), "The public residency collection does not exist.");
  }

  @Get("life-events")
  @Public()
  @ApiOperation({ operationId: "listPublicLifeEvents", summary: "List panda life events from one active release" })
  @ApiOkResponse({ type: PublicLifeEventListDto })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async listLifeEvents() {
    return publicResult(await this.publicRead.listLifeEvents(), "The public life-event collection does not exist.");
  }

  @Get("evidence/:sourceId")
  @Public()
  @ApiOperation({ operationId: "getPublicEvidence", summary: "Get public-safe evidence metadata" })
  @ApiOkResponse({ type: PublicEvidenceDetailDto })
  @ApiNotFoundResponse({ description: "The evidence source is absent or under emergency takedown." })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async getEvidence(@Param("sourceId") sourceId: string) {
    return publicResult(
      await this.publicRead.getEvidence(sourceId),
      "The public evidence source does not exist.",
    );
  }

  @Get("stats")
  @Public()
  @ApiOperation({ operationId: "getPublicStats", summary: "Get sealed-release public projection counts" })
  @ApiOkResponse({ type: PublicStatsResponseDto })
  @ApiServiceUnavailableResponse({ description: "No active deliverable release is available." })
  public async stats() {
    return publicResult(await this.publicRead.stats(), "Public release statistics do not exist.");
  }
}
