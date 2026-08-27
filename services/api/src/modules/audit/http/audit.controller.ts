import { Controller, DefaultValuePipe, Get, Inject, ParseIntPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { AUDIT_PORT, type AuditPort } from "../application/audit.application.js";
import { AuditEvidenceDto } from "./audit.dto.js";

@ApiTags("Audit")
@ApiBearerAuth("supabaseJwt")
@Controller("audit/evidence")
export class AuditController {
  public constructor(@Inject(AUDIT_PORT) private readonly audit: AuditPort) {}

  @Get()
  @RequireCapabilities("audit.read")
  @ApiOperation({ operationId: "listAuditEvidence", summary: "List selected append-only V2 audit evidence" })
  @ApiQuery({ name: "limit", required: false, type: Number, minimum: 1, maximum: 200 })
  @ApiOkResponse({ type: AuditEvidenceDto, isArray: true })
  public list(@Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.audit.list(limit);
  }
}
