import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class RunScheduledCyclesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  public cycles?: number;
}

export class TakeDownAndRestoreDto {
  @IsUUID()
  public pandaId!: string;
}

export class ExpireRecentAuthDto {
  @IsUUID()
  public accountId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  public afterEpochSeconds?: number;
}
