import { Module } from "@nestjs/common";
import {
  ENGAGEMENT_FOLLOW_COUNT_PORT,
  type EngagementFollowCountPort,
} from "../engagement/application/engagement-follow-count.port.js";
import { EngagementModule } from "../engagement/engagement.module.js";
import { PUBLIC_READ_PORT, type PublicReadPort } from "../public-read/application/public-read.application.js";
import { PublicReadModule } from "../public-read/public-read.module.js";
import { PopularityApplication } from "./application/popularity.application.js";
import { PopularityController } from "./http/popularity.controller.js";

@Module({
  imports: [EngagementModule, PublicReadModule],
  controllers: [PopularityController],
  providers: [
    {
      provide: PopularityApplication,
      useFactory: (followCounts: EngagementFollowCountPort, publicRead: PublicReadPort) =>
        new PopularityApplication(followCounts, publicRead),
      inject: [ENGAGEMENT_FOLLOW_COUNT_PORT, PUBLIC_READ_PORT],
    },
  ],
})
export class PopularityModule {}
