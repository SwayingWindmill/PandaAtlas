import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { MEDIA_PUBLICATION_PORT } from "./application/media-publication.application.js";
import {
  MEDIA_PORT,
  MediaApplication,
} from "./application/media.application.js";
import { PostgresMediaPublicationQuery } from "./infrastructure/postgres-media-publication.query.js";
import { PostgresMediaRepository } from "./infrastructure/postgres-media.repository.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: MEDIA_PORT,
      useFactory: (database: DatabaseService) => new MediaApplication(new PostgresMediaRepository(database)),
      inject: [DatabaseService],
    },
    { provide: MEDIA_PUBLICATION_PORT, useFactory: () => new PostgresMediaPublicationQuery() },
  ],
  exports: [MEDIA_PORT, MEDIA_PUBLICATION_PORT],
})
export class MediaModule {}
