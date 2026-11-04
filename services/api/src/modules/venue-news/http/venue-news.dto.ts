import { ApiProperty } from "@nestjs/swagger";
import { VENUE_NEWS_KINDS } from "../application/venue-news-catalog.js";

export class VenueNewsItemDto {
  @ApiProperty() public id!: string;
  @ApiProperty() public institutionSlug!: string;
  @ApiProperty({ enum: VENUE_NEWS_KINDS }) public kind!: string;
  @ApiProperty({ description: "The announcement's own headline, verbatim." }) public headline!: string;
  @ApiProperty({ type: [String] }) public pandaSlugs!: string[];
  @ApiProperty({ description: "The institution's announcement (https)." }) public sourceUrl!: string;
  @ApiProperty() public sourcePublisher!: string;
  @ApiProperty({ format: "date" }) public publishedOn!: string;
  @ApiProperty({ format: "date-time", description: "When this entry was last checked against the source." })
  public updatedAt!: string;
}

export class VenueNewsDto {
  @ApiProperty() public version!: string;
  @ApiProperty({ type: [VenueNewsItemDto] }) public items!: VenueNewsItemDto[];
}
