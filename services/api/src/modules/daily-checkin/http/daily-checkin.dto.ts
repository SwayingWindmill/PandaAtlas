import { ApiProperty } from "@nestjs/swagger";
import { Matches } from "class-validator";

export class DailyCheckinTodayDto {
  @ApiProperty({ format: "date", description: "The member's local calendar date." })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public today!: string;
}

export class DailyCheckinRulesDto {
  @ApiProperty({ type: Number, description: "Leave days (请假) per calendar month, retroactive leave included." })
  public declare leaveDaysPerMonth: number;

  @ApiProperty({ type: Number, description: "Retroactive leaves (补请) per calendar month." })
  public declare retroLeavesPerMonth: number;

  @ApiProperty({ type: Number, description: "Hours after a missed day during which 补请 stays open." })
  public declare retroWindowHours: number;

  @ApiProperty({ type: Number, description: "How many days ahead a leave can be planned." })
  public declare leaveAheadDays: number;
}

export class DailyCheckinMonthDto {
  @ApiProperty({ example: "2026-10" })
  public declare month: string;

  @ApiProperty({ type: Number })
  public declare visitDays: number;

  @ApiProperty({ type: Number })
  public declare leaveDays: number;

  @ApiProperty({ type: Number })
  public declare leaveLeft: number;

  @ApiProperty({ type: Number })
  public declare retroLeft: number;
}

export class DailyCheckinDayDto {
  @ApiProperty({ format: "date" })
  public declare day: string;

  @ApiProperty({ enum: ["visit", "leave"] })
  public declare kind: "visit" | "leave";

  @ApiProperty({ type: Boolean })
  public declare retroactive: boolean;
}

export class DailyCheckinSummaryDto {
  @ApiProperty({ format: "date" })
  public declare today: string;

  @ApiProperty({ type: () => DailyCheckinRulesDto })
  public declare rules: DailyCheckinRulesDto;

  @ApiProperty({ type: Boolean })
  public declare visitedToday: boolean;

  @ApiProperty({ type: Number, description: "All visit days ever. Never resets." })
  public declare totalVisitDays: number;

  @ApiProperty({ type: String, format: "date", nullable: true })
  public declare firstDay: string | null;

  @ApiProperty({ type: () => DailyCheckinMonthDto })
  public declare thisMonth: DailyCheckinMonthDto;

  @ApiProperty({ type: String, format: "date", nullable: true, description: "The missed day 补请 can still cover." })
  public declare retroDay: string | null;

  @ApiProperty({ type: () => DailyCheckinDayDto, isArray: true })
  public declare days: DailyCheckinDayDto[];
}
