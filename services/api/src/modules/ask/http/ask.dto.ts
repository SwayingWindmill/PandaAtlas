import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class AskQuestionDto {
  // The server counts characters after normalising and refuses more than 500 with ask.questionTooLong.
  @ApiProperty({ minLength: 1, maxLength: 2000, description: "The question. It is answered and then discarded; it is never stored." })
  @IsString()
  @MaxLength(2000)
  public question!: string;
}

export class AskReferenceDto {
  @ApiProperty()
  public title!: string;

  @ApiProperty({ type: String, nullable: true })
  public publisher!: string | null;

  @ApiProperty({ format: "uri" })
  public url!: string;
}

export class AskLinkDto {
  @ApiProperty({ enum: ["article", "card", "topic", "term", "faceGuide", "challenge", "panda", "learn"] })
  public kind!: string;

  @ApiProperty()
  public title!: string;

  @ApiProperty({ description: "A path inside the app, such as /learn/articles/bamboo." })
  public appPath!: string;

  @ApiProperty({ type: [AskReferenceDto] })
  public references!: AskReferenceDto[];
}

export class AskAnswerDto {
  @ApiProperty({ enum: ["answer", "refusal", "identification"] })
  public kind!: "answer" | "refusal" | "identification";

  @ApiProperty({ enum: ["zh", "en"] })
  public locale!: "zh" | "en";

  @ApiProperty({ description: "The answer, or why there is none." })
  public text!: string;

  @ApiPropertyOptional({ enum: ["noMatch", "unsafe", "unavailable"] })
  public reason?: "noMatch" | "unsafe" | "unavailable";

  @ApiProperty({ type: [AskLinkDto], description: "Pages the answer came from, or where to read instead." })
  public links!: AskLinkDto[];

  @ApiProperty({ minimum: 0 })
  public remainingToday!: number;
}

export class AskStatusDto {
  @ApiProperty()
  public enabled!: boolean;

  @ApiProperty({ minimum: 0 })
  public dailyLimit!: number;

  @ApiProperty({ minimum: 0 })
  public remainingToday!: number;
}
