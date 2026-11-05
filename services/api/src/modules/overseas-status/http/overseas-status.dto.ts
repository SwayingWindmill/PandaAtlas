import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OVERSEAS_STAGES } from "../application/overseas-status-catalog.js";

export class PartialDateDto {
  @ApiProperty({ description: "YYYY-MM-DD, YYYY-MM or YYYY, matching precision." }) public on!: string;
  @ApiProperty({ enum: ["day", "month", "year"] }) public precision!: "day" | "month" | "year";
}

export class OverseasStatusItemDto {
  @ApiProperty() public pandaSlug!: string;
  @ApiProperty({ enum: OVERSEAS_STAGES }) public stage!: string;
  @ApiProperty({ description: "Where the panda is now: the overseas home, or the quarantine base once back." })
  public institutionSlug!: string;
  @ApiPropertyOptional({ type: () => PartialDateDto, description: "The return as announced." })
  public expectedReturn?: PartialDateDto;
  @ApiPropertyOptional({ format: "date" }) public returnedOn?: string;
  @ApiProperty({ description: "The announcement this entry rests on (https)." }) public sourceUrl!: string;
  @ApiProperty() public sourcePublisher!: string;
  @ApiProperty({ format: "date-time", description: "When this entry was last checked against the source." })
  public updatedAt!: string;
}

export class OverseasStatusDto {
  @ApiProperty() public version!: string;
  @ApiProperty({ type: [OverseasStatusItemDto] }) public items!: OverseasStatusItemDto[];
}
