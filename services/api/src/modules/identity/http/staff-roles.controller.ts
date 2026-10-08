import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, ValidationPipe } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import type { FastifyRequest } from "fastify";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { StaffRolesService } from "../infrastructure/staff-roles.service.js";
import { RequireCapabilities } from "./access.metadata.js";
import { getActorContext } from "./request-actor.js";

class RoleChangeDto {
  @ApiProperty({ example: "Reviewed the staff responsibility change with the archive lead" })
  @IsString() @MinLength(1) @MaxLength(500)
  public declare reason: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  public declare idempotencyKey: string;
}

export class GrantStaffRoleDto extends RoleChangeDto {
  @ApiProperty({ example: "reviewer" })
  @IsString() @MinLength(3) @MaxLength(64)
  public declare roleKey: string;
}

export class RevokeStaffRoleDto extends RoleChangeDto {}

export class StaffRoleCatalogDto {
  @ApiProperty() public declare roleKey: string;
  @ApiProperty() public declare displayName: string;
  @ApiProperty() public declare description: string;
}

export class StaffAccountSummaryDto {
  @ApiProperty({ format: "uuid" }) public declare accountId: string;
  @ApiProperty({ nullable: true, type: String }) public declare email: string | null;
  @ApiProperty() public declare state: string;
  @ApiProperty({ type: [String] }) public declare roles: string[];
}

export class StaffAssignmentDto {
  @ApiProperty({ format: "uuid" }) public declare assignmentId: string;
  @ApiProperty() public declare roleKey: string;
  @ApiProperty() public declare roleName: string;
  @ApiProperty() public declare assignedAt: Date;
  @ApiProperty({ nullable: true, type: String }) public declare assignedBy: string | null;
  @ApiProperty() public declare reason: string;
  @ApiProperty({ enum: ["active", "revoked", "expired"] }) public declare status: "active" | "revoked" | "expired";
  @ApiProperty({ nullable: true, type: Date }) public declare revokedAt: Date | null;
  @ApiProperty({ nullable: true, type: String }) public declare revokedBy: string | null;
  @ApiProperty({ nullable: true, type: String }) public declare revocationReason: string | null;
}

export class StaffAccountDetailDto {
  @ApiProperty({ format: "uuid" }) public declare accountId: string;
  @ApiProperty({ nullable: true, type: String }) public declare email: string | null;
  @ApiProperty() public declare state: string;
  @ApiProperty({ type: [StaffAssignmentDto] }) public declare assignments: StaffAssignmentDto[];
  @ApiProperty({ type: [String] }) public declare capabilities: string[];
}

export class StaffRoleChangeResultDto {
  @ApiProperty({ format: "uuid" }) public declare assignmentId: string;
  @ApiProperty() public declare roleKey: string;
  @ApiProperty({ enum: ["active", "revoked"] }) public declare status: "active" | "revoked";
}

@ApiTags("Staff IAM")
@Controller("staff/accounts")
export class StaffRolesController {
  public constructor(private readonly staff: StaffRolesService, private readonly requests: RequestContextService) {}

  @Get()
  @RequireCapabilities("identity.role.manage")
  @ApiOperation({ operationId: "listStaffAccounts" })
  @ApiOkResponse({ type: StaffAccountSummaryDto, isArray: true })
  public directory() { return this.staff.directory(); }

  @Get("catalog")
  @RequireCapabilities("identity.role.manage")
  @ApiOperation({ operationId: "listDelegableStaffRoles" })
  @ApiOkResponse({ type: StaffRoleCatalogDto, isArray: true })
  public roles() { return this.staff.roles(); }

  @Get(":accountId")
  @RequireCapabilities("identity.role.manage")
  @ApiOperation({ operationId: "getStaffAccountRoles" })
  @ApiOkResponse({ type: StaffAccountDetailDto })
  public detail(@Param("accountId", new ParseUUIDPipe()) accountId: string) { return this.staff.detail(accountId); }

  @Post(":accountId/roles")
  @RequireCapabilities("identity.role.manage")
  @ApiOperation({ operationId: "grantStaffRole" })
  @ApiCreatedResponse({ type: StaffRoleChangeResultDto })
  public grant(
    @Req() request: FastifyRequest,
    @Param("accountId", new ParseUUIDPipe()) accountId: string,
    @Body(new ValidationPipe({ whitelist: true })) input: GrantStaffRoleDto,
  ) {
    const { actorId, correlationId } = this.actor(request);
    return this.staff.grant(accountId, input.roleKey, input.reason, input.idempotencyKey, actorId, correlationId);
  }

  @Post(":accountId/roles/:assignmentId/revoke")
  @RequireCapabilities("identity.role.manage")
  @ApiOperation({ operationId: "revokeStaffRole" })
  @ApiCreatedResponse({ type: StaffRoleChangeResultDto })
  public revoke(
    @Req() request: FastifyRequest,
    @Param("accountId", new ParseUUIDPipe()) accountId: string,
    @Param("assignmentId", new ParseUUIDPipe()) assignmentId: string,
    @Body(new ValidationPipe({ whitelist: true })) input: RevokeStaffRoleDto,
  ) {
    const { actorId, correlationId } = this.actor(request);
    return this.staff.revoke(accountId, assignmentId, input.reason, input.idempotencyKey, actorId, correlationId);
  }

  private actor(request: FastifyRequest) {
    const actor = getActorContext(request);
    const correlationId = this.requests.current?.correlationId;
    if (!actor || !correlationId) throw new ProblemException(500, "system.internal", "Authorized staff context unavailable.");
    return { actorId: actor.accountId, correlationId };
  }
}
