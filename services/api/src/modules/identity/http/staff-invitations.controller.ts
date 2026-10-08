import { Body, Controller, Get, Post, Req, ValidationPipe } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsEmail } from "class-validator";
import type { FastifyRequest } from "fastify";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { getVerifiedIdentity } from "../../../platform/auth/request-auth.js";
import { StaffInvitationsService } from "../infrastructure/staff-invitations.service.js";
import { AllowUnprovisioned, RequireCapabilities } from "./access.metadata.js";
import { getActorContext } from "./request-actor.js";

export class InviteReviewerDto {
  @ApiProperty({ example: "reviewer@example.com" })
  @IsEmail()
  public declare email: string;
}

export class StaffInvitationDto {
  @ApiProperty() public declare invitationId: string;
  @ApiProperty() public declare email: string;
  @ApiProperty() public declare status: string;
  @ApiProperty() public declare createdAt: Date;
}

export class IssuedStaffInvitationDto {
  @ApiProperty() public declare invitationId: string;
  @ApiProperty() public declare email: string;
  @ApiProperty() public declare status: "pending";
}

export class AcceptedInvitationDto {
  @ApiProperty() public declare accountId: string;
  @ApiProperty() public declare status: "accepted";
}

@ApiTags("Staff IAM")
@Controller("staff/invitations")
export class StaffInvitationsController {
  public constructor(
    private readonly invitations: StaffInvitationsService,
    private readonly requests: RequestContextService,
  ) {}

  @Get()
  @RequireCapabilities("identity.staff.read")
  @ApiOperation({ operationId: "listStaffInvitations" })
  @ApiOkResponse({ type: StaffInvitationDto, isArray: true })
  public list() {
    return this.invitations.list();
  }

  @Post()
  @RequireCapabilities("identity.account.manage", "identity.role.manage")
  @ApiOperation({ operationId: "inviteStaffReviewer" })
  @ApiCreatedResponse({ type: IssuedStaffInvitationDto })
  public invite(@Req() request: FastifyRequest, @Body(new ValidationPipe({ transform: true, whitelist: true })) input: InviteReviewerDto) {
    const actor = getActorContext(request);
    const correlationId = this.requests.current?.correlationId;
    if (!actor || !correlationId) {
      throw new ProblemException(500, "system.internal", "The authorized actor context is unavailable.");
    }
    return this.invitations.invite(input.email, actor.accountId, correlationId);
  }
}

@ApiTags("Staff IAM")
@Controller("me/staff-invitation")
export class AcceptStaffInvitationController {
  public constructor(
    private readonly invitations: StaffInvitationsService,
    private readonly requests: RequestContextService,
  ) {}

  @Post("accept")
  @AllowUnprovisioned()
  @ApiOperation({ operationId: "acceptStaffReviewerInvitation" })
  @ApiCreatedResponse({ type: AcceptedInvitationDto })
  public accept(@Req() request: FastifyRequest) {
    const verified = getVerifiedIdentity(request);
    const correlationId = this.requests.current?.correlationId;
    if (!verified || !correlationId) {
      throw new ProblemException(500, "system.internal", "The authenticated subject is unavailable.");
    }
    return this.invitations.accept(verified.accountId, verified.sessionId, correlationId);
  }
}
