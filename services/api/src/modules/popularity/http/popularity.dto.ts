import { ApiProperty } from "@nestjs/swagger";

export class PopularPandaDto {
  @ApiProperty() public pandaId!: string;
  @ApiProperty() public slug!: string;
}

export class PopularPandasDto {
  @ApiProperty({ description: "How many days back the follows are counted." }) public windowDays!: number;
  @ApiProperty({ type: [PopularPandaDto], description: "Most new followers first. No counts are published." })
  public items!: PopularPandaDto[];
}
