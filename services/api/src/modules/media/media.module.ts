import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { MEDIA_PUBLICATION_PORT } from "./application/media-publication.application.js";
import {
  MEDIA_PORT,
  MEDIA_REPOSITORY,
  MediaApplication,
  type MediaRepository,
} from "./application/media.application.js";
import { PostgresMediaPublicationQuery } from "./infrastructure/postgres-media-publication.query.js";
import { PostgresMediaRepository } from "./infrastructure/postgres-media.repository.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: MEDIA_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresMediaRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: MEDIA_PORT,
      useFactory: (repository: MediaRepository) => new MediaApplication(repository),
      inject: [MEDIA_REPOSITORY],
    },
    { provide: MEDIA_PUBLICATION_PORT, useFactory: () => new PostgresMediaPublicationQuery() },
  ],
  exports: [MEDIA_PORT, MEDIA_PUBLICATION_PORT],
})
export class MediaModule {}
