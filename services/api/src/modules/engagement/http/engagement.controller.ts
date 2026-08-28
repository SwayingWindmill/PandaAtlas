import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { ENGAGEMENT_PORT, type EngagementPort } from "../application/engagement.application.js";
import {
  CheckinDto,
  CheckinListDto,
  CollectionDto,
  CollectionListDto,
  CollectionNameDto,
  CreateCheckinDto,
  DeletedCheckinDto,
  DeletedCollectionDto,
  DeletedSeenPandaDto,
  FavoriteDto,
  FavoriteListDto,
  SaveSeenPandaDto,
  SeenPandaDto,
  SeenPandaListDto,
  UnfavoriteDto,
} from "./engagement.dto.js";

function accountId(request: FastifyRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) {
    throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  }
  return actor.accountId;
}

function collectionNotFound(): never {
  throw new ProblemException(404, "engagement.collectionNotFound", "The collection does not exist.");
}

@ApiTags("Engagement")
@Controller("me")
export class EngagementController {
  public constructor(@Inject(ENGAGEMENT_PORT) private readonly engagement: EngagementPort) {}

  @Get("favorites")
  @RequireCapabilities("engagement.read")
  @ApiOperation({ operationId: "listFavorites" })
  @ApiOkResponse({ type: FavoriteListDto })
  public async listFavorites(@Req() request: FastifyRequest) {
    return { items: await this.engagement.listFavorites(accountId(request)) };
  }

  @Post("favorites/:pandaId")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "favoritePanda" })
  @ApiCreatedResponse({ type: FavoriteDto })
  public favorite(
    @Req() request: FastifyRequest,
    @Param("pandaId", ParseUUIDPipe) pandaId: string,
  ) {
    return this.engagement.favorite(accountId(request), pandaId);
  }

  @Delete("favorites/:pandaId")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "unfavoritePanda" })
  @ApiOkResponse({ type: UnfavoriteDto })
  public async unfavorite(
    @Req() request: FastifyRequest,
    @Param("pandaId", ParseUUIDPipe) pandaId: string,
  ) {
    await this.engagement.unfavorite(accountId(request), pandaId);
    return { pandaId, favorited: false as const, favoritedAt: null };
  }

  @Get("collections")
  @RequireCapabilities("engagement.read")
  @ApiOperation({ operationId: "listCollections" })
  @ApiOkResponse({ type: CollectionListDto })
  public async listCollections(@Req() request: FastifyRequest) {
    return { items: await this.engagement.listCollections(accountId(request)) };
  }

  @Post("collections")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "createCollection" })
  @ApiCreatedResponse({ type: CollectionDto })
  public createCollection(@Req() request: FastifyRequest, @Body() input: CollectionNameDto) {
    return this.engagement.createCollection(accountId(request), input.name);
  }

  @Patch("collections/:collectionId")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "renameCollection" })
  @ApiOkResponse({ type: CollectionDto })
  public async renameCollection(
    @Req() request: FastifyRequest,
    @Param("collectionId", ParseUUIDPipe) collectionId: string,
    @Body() input: CollectionNameDto,
  ) {
    return (
      (await this.engagement.renameCollection(accountId(request), collectionId, input.name)) ??
      collectionNotFound()
    );
  }

  @Delete("collections/:collectionId")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "deleteCollection" })
  @ApiOkResponse({ type: DeletedCollectionDto })
  public async deleteCollection(
    @Req() request: FastifyRequest,
    @Param("collectionId", ParseUUIDPipe) collectionId: string,
  ) {
    if (!(await this.engagement.deleteCollection(accountId(request), collectionId))) {
      collectionNotFound();
    }
    return { collectionId, deleted: true as const };
  }

  @Post("collections/:collectionId/pandas/:pandaId")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "addPandaToCollection" })
  @ApiCreatedResponse({ type: CollectionDto })
  public async addPandaToCollection(
    @Req() request: FastifyRequest,
    @Param("collectionId", ParseUUIDPipe) collectionId: string,
    @Param("pandaId", ParseUUIDPipe) pandaId: string,
  ) {
    return (
      (await this.engagement.addPandaToCollection(accountId(request), collectionId, pandaId)) ??
      collectionNotFound()
    );
  }

  @Delete("collections/:collectionId/pandas/:pandaId")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "removePandaFromCollection" })
  @ApiOkResponse({ type: CollectionDto })
  public async removePandaFromCollection(
    @Req() request: FastifyRequest,
    @Param("collectionId", ParseUUIDPipe) collectionId: string,
    @Param("pandaId", ParseUUIDPipe) pandaId: string,
  ) {
    return (
      (await this.engagement.removePandaFromCollection(accountId(request), collectionId, pandaId)) ??
      collectionNotFound()
    );
  }

  @Get("checkins")
  @RequireCapabilities("engagement.read")
  @ApiOperation({ operationId: "listCheckins" })
  @ApiOkResponse({ type: CheckinListDto })
  public async listCheckins(@Req() request: FastifyRequest) {
    return { items: await this.engagement.listCheckins(accountId(request)) };
  }

  @Post("checkins")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "createCheckin" })
  @ApiCreatedResponse({ type: CheckinDto })
  public createCheckin(@Req() request: FastifyRequest, @Body() input: CreateCheckinDto) {
    return this.engagement.createCheckin(accountId(request), {
      placeId: input.placeId,
      visitedOn: input.visitedOn,
      note: input.note ?? null,
    });
  }

  @Delete("checkins/:checkinId")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "deleteCheckin" })
  @ApiOkResponse({ type: DeletedCheckinDto })
  public async deleteCheckin(
    @Req() request: FastifyRequest,
    @Param("checkinId", ParseUUIDPipe) checkinId: string,
  ) {
    if (!(await this.engagement.deleteCheckin(accountId(request), checkinId))) {
      throw new ProblemException(404, "engagement.checkinNotFound", "The check-in does not exist.");
    }
    return { checkinId, deleted: true as const };
  }

  @Get("seen-pandas")
  @RequireCapabilities("engagement.read")
  @ApiOperation({ operationId: "listSeenPandas" })
  @ApiOkResponse({ type: SeenPandaListDto })
  public async listSeenPandas(@Req() request: FastifyRequest) {
    return { items: await this.engagement.listSeenPandas(accountId(request)) };
  }

  @Get("seen-pandas/:pandaId")
  @RequireCapabilities("engagement.read")
  @ApiOperation({ operationId: "getSeenPanda" })
  @ApiOkResponse({ type: SeenPandaDto })
  public async getSeenPanda(
    @Req() request: FastifyRequest,
    @Param("pandaId", ParseUUIDPipe) pandaId: string,
  ) {
    const seen = await this.engagement.getSeenPanda(accountId(request), pandaId);
    if (seen === undefined) {
      throw new ProblemException(404, "engagement.seenPandaNotFound", "The seen-panda entry does not exist.");
    }
    return seen;
  }

  @Put("seen-pandas/:pandaId")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "saveSeenPanda" })
  @ApiOkResponse({ type: SeenPandaDto })
  public saveSeenPanda(
    @Req() request: FastifyRequest,
    @Param("pandaId", ParseUUIDPipe) pandaId: string,
    @Body() input: SaveSeenPandaDto,
  ) {
    return this.engagement.saveSeenPanda(accountId(request), {
      pandaId,
      seenOn: input.seenOn ?? null,
      placeId: input.placeId ?? null,
      note: input.note ?? null,
    });
  }

  @Delete("seen-pandas/:pandaId")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "deleteSeenPanda" })
  @ApiOkResponse({ type: DeletedSeenPandaDto })
  public async deleteSeenPanda(
    @Req() request: FastifyRequest,
    @Param("pandaId", ParseUUIDPipe) pandaId: string,
  ) {
    if (!(await this.engagement.deleteSeenPanda(accountId(request), pandaId))) {
      throw new ProblemException(404, "engagement.seenPandaNotFound", "The seen-panda entry does not exist.");
    }
    return { pandaId, deleted: true as const };
  }
}
