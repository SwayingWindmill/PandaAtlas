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

export class LearningArticleParagraphDto {
  @ApiProperty({ type: LearningTextDto })
  public declare text: LearningTextDto;

  @ApiProperty({ type: [String] })
  public declare refs: string[];
}

export class LearningArticleSectionDto {
  @ApiProperty({ type: LearningTextDto })
  public declare heading: LearningTextDto;

  @ApiProperty({ type: [LearningArticleParagraphDto] })
  public declare paragraphs: LearningArticleParagraphDto[];
}

export class LearningArticleBodyDto {
  @ApiProperty({ type: [LearningArticleSectionDto] })
  public declare sections: LearningArticleSectionDto[];
}

export class LearningArticleFactDto {
  @ApiProperty({ type: LearningTextDto })
  public declare text: LearningTextDto;

  @ApiProperty({ type: [String] })
  public declare refs: string[];
}

export class LearningArticleImageDto {
  @ApiProperty({ enum: ["hero", "inline", "compare"] })
  public declare role: "hero" | "inline" | "compare";

  @ApiProperty({ enum: ["existing", "wanted"] })
  public declare type: "existing" | "wanted";

  @ApiProperty({ type: String, nullable: true })
  public declare pandaSlug: string | null;

  @ApiProperty({ required: false })
  public declare asset?: string;

  @ApiProperty({ required: false })
  public declare credit?: string;

  @ApiProperty({ type: LearningTextDto })
  public declare caption: LearningTextDto;

  @ApiProperty({ type: LearningTextDto, required: false })
  public declare shot?: LearningTextDto;
}

export class LearningArticleReferenceDto {
  @ApiProperty()
  public declare id: string;

  @ApiProperty()
  public declare title: string;

  @ApiProperty()
  public declare publisher: string;

  @ApiProperty({ format: "uri" })
  public declare url: string;

  @ApiProperty({ format: "date" })
  public declare citedOn: string;
}

export class LearningArticleDto {
  @ApiProperty()
  public declare slug: string;

  @ApiProperty({ enum: ["外形与识别", "食性", "繁殖与成长", "保护"] })
  public declare category: string;

  @ApiProperty({ type: LearningTextDto })
  public declare title: LearningTextDto;

  @ApiProperty({ type: LearningTextDto })
  public declare dek: LearningTextDto;

  @ApiProperty({ type: LearningTextDto })
  public declare pullQuote: LearningTextDto;

  @ApiProperty({ type: LearningArticleBodyDto })
  public declare body: LearningArticleBodyDto;

  @ApiProperty({ type: [LearningArticleFactDto] })
  public declare keyFacts: LearningArticleFactDto[];

  @ApiProperty({ type: [LearningArticleImageDto] })
  public declare images: LearningArticleImageDto[];

  @ApiProperty({ type: [LearningArticleReferenceDto] })
  public declare references: LearningArticleReferenceDto[];

  @ApiProperty({ type: [String] })
  public declare relatedArticles: string[];
}

export class LearningCatalogDto {
  @ApiProperty({ example: "2026.10.29.2" })
  public declare version: string;

  @ApiProperty({ type: [LearningArticleDto] })
  public declare articles: LearningArticleDto[];

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
