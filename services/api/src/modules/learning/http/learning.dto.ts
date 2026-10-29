import { ApiProperty } from "@nestjs/swagger";
import type { FaceTipKey } from "../application/learning-catalog.js";

export class LearningTextDto {
  @ApiProperty()
  public declare zh: string;

  @ApiProperty()
  public declare en: string;
}

export class LearningSourceDto {
  @ApiProperty({ type: LearningTextDto })
  public declare title: LearningTextDto;

  @ApiProperty({ format: "uri" })
  public declare url: string;

  @ApiProperty({ format: "date" })
  public declare citedOn: string;
}

export class LearningCardDto {
  @ApiProperty()
  public declare slug: string;

  @ApiProperty({ type: LearningTextDto })
  public declare title: LearningTextDto;

  @ApiProperty({ type: LearningTextDto })
  public declare summary: LearningTextDto;

  @ApiProperty({ type: LearningTextDto })
  public declare body: LearningTextDto;

  @ApiProperty({ type: [LearningSourceDto] })
  public declare sources: LearningSourceDto[];
}

export class LearningTopicSectionDto {
  @ApiProperty({ type: LearningTextDto })
  public declare heading: LearningTextDto;

  @ApiProperty({ type: LearningTextDto })
  public declare body: LearningTextDto;
}

export class LearningTopicDto {
  @ApiProperty()
  public declare slug: string;

  @ApiProperty({ type: LearningTextDto })
  public declare title: LearningTextDto;

  @ApiProperty({ type: LearningTextDto })
  public declare summary: LearningTextDto;

  @ApiProperty({ type: [LearningTopicSectionDto] })
  public declare sections: LearningTopicSectionDto[];

  @ApiProperty({ type: [String] })
  public declare cardSlugs: string[];

  @ApiProperty({ type: [LearningSourceDto] })
  public declare sources: LearningSourceDto[];
}

export class LearningTermDto {
  @ApiProperty()
  public declare slug: string;

  @ApiProperty({ type: LearningTextDto })
  public declare term: LearningTextDto;

  @ApiProperty({ type: LearningTextDto })
  public declare definition: LearningTextDto;

  @ApiProperty({ type: [String] })
  public declare relatedSlugs: string[];

  @ApiProperty({ type: [LearningSourceDto] })
  public declare sources: LearningSourceDto[];
}

export class LearningFaceTipDto {
  @ApiProperty({ enum: ["shape", "leftRight", "eyePatches", "ears"] })
  public declare key: FaceTipKey;

  @ApiProperty({ type: LearningTextDto })
  public declare label: LearningTextDto;

  @ApiProperty({ type: LearningTextDto })
  public declare body: LearningTextDto;
}

export class LearningFaceGuideDto {
  @ApiProperty()
  public declare slug: string;

  @ApiProperty({ description: "Canonical slug of a published panda. The photo comes from that panda's media." })
  public declare pandaSlug: string;

  @ApiProperty({ type: LearningTextDto })
  public declare title: LearningTextDto;

  @ApiProperty({ type: [LearningFaceTipDto] })
  public declare tips: LearningFaceTipDto[];

  @ApiProperty({ type: [LearningSourceDto] })
  public declare sources: LearningSourceDto[];
}

export class LearningChallengeDto {
  @ApiProperty()
  public declare slug: string;

  @ApiProperty()
  public declare answerPandaSlug: string;

  @ApiProperty({ type: [String] })
  public declare decoyPandaSlugs: string[];

  @ApiProperty({ type: LearningTextDto })
  public declare prompt: LearningTextDto;

  @ApiProperty({ type: LearningTextDto })
  public declare tip: LearningTextDto;

  @ApiProperty({ type: [LearningSourceDto] })
  public declare sources: LearningSourceDto[];
}

export class LearningCatalogDto {
  @ApiProperty({ example: "2026.10.29.1" })
  public declare version: string;

  @ApiProperty({ type: [LearningCardDto] })
  public declare cards: LearningCardDto[];

  @ApiProperty({ type: [LearningTopicDto] })
  public declare topics: LearningTopicDto[];

  @ApiProperty({ type: [LearningTermDto] })
  public declare terms: LearningTermDto[];

  @ApiProperty({ type: [LearningFaceGuideDto] })
  public declare faceGuides: LearningFaceGuideDto[];

  @ApiProperty({ type: [LearningChallengeDto] })
  public declare challenges: LearningChallengeDto[];
}
