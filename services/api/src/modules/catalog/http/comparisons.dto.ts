import { ApiProperty } from "@nestjs/swagger";

export class ComparisonDto {
  @ApiProperty() public id!: string;
  @ApiProperty({ description: "What the pair is, 16 characters or fewer." }) public title!: string;
  @ApiProperty({ description: "One line on what tells them apart, 30 characters or fewer." }) public dek!: string;
  @ApiProperty({ type: [String], minItems: 2, maxItems: 2, description: "Two different pandas, in display order." })
  public pandaSlugs!: string[];
  @ApiProperty({ format: "date-time", description: "When this entry was last checked." }) public updatedAt!: string;
}

export class ComparisonsDto {
  @ApiProperty() public version!: string;
  @ApiProperty({ type: [ComparisonDto] }) public items!: ComparisonDto[];
}
