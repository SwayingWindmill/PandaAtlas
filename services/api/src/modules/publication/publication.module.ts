import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationOutboxService } from "../../platform/integration/integration-outbox.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import { EVIDENCE_PUBLICATION_PORT, type EvidencePublicationPort } from "../evidence/application/evidence-publication.application.js";
import { EvidenceModule } from "../evidence/evidence.module.js";
import { LIFE_HISTORY_PUBLICATION_PORT, type LifeHistoryPublicationPort } from "../life-history/application/life-history-publication.application.js";
import { LifeHistoryModule } from "../life-history/life-history.module.js";
import { LINEAGE_PUBLICATION_PORT, type LineagePublicationPort } from "../lineage/application/lineage-publication.application.js";
import { LineageModule } from "../lineage/lineage.module.js";
import { MEDIA_PUBLICATION_PORT, type MediaPublicationPort } from "../media/application/media-publication.application.js";
import { MediaModule } from "../media/media.module.js";
import { PANDA_PUBLICATION_PORT, type PandaPublicationPort } from "../panda/application/panda-publication.application.js";
import { PandaModule } from "../panda/panda.module.js";
import { PLACES_PUBLICATION_PORT, type PlacesPublicationPort } from "../places/application/places-publication.application.js";
import { PlacesModule } from "../places/places.module.js";
import { PUBLIC_READ_PORT } from "./application/public-read.application.js";
import {
  PUBLICATION_COORDINATOR,
  PUBLICATION_PORT,
  PublicationApplication,
  type PublicationCoordinator,
} from "./application/publication.application.js";
import { PublicReadController } from "./http/public-read.controller.js";
import { PublicationController } from "./http/publication.controller.js";
import { PostgresPublicReadRepository } from "./infrastructure/postgres-public-read.repository.js";
import { PostgresPublicationCoordinator } from "./infrastructure/postgres-publication.coordinator.js";

@Module({
  imports: [
    DatabaseModule,
    IntegrationModule,
    RequestContextModule,
    EvidenceModule,
    PandaModule,
    PlacesModule,
    LifeHistoryModule,
    LineageModule,
    MediaModule,
  ],
  controllers: [PublicReadController, PublicationController],
  providers: [
    {
      provide: PUBLICATION_COORDINATOR,
      useFactory: (
        database: DatabaseService,
        outbox: IntegrationOutboxService,
        evidence: EvidencePublicationPort,
        pandas: PandaPublicationPort,
        places: PlacesPublicationPort,
        lifeHistory: LifeHistoryPublicationPort,
        lineage: LineagePublicationPort,
        media: MediaPublicationPort,
      ) => new PostgresPublicationCoordinator(database, outbox, evidence, pandas, places, lifeHistory, lineage, media),
      inject: [
        DatabaseService,
        IntegrationOutboxService,
        EVIDENCE_PUBLICATION_PORT,
        PANDA_PUBLICATION_PORT,
        PLACES_PUBLICATION_PORT,
        LIFE_HISTORY_PUBLICATION_PORT,
        LINEAGE_PUBLICATION_PORT,
        MEDIA_PUBLICATION_PORT,
      ],
    },
    {
      provide: PUBLICATION_PORT,
      useFactory: (coordinator: PublicationCoordinator) => new PublicationApplication(coordinator),
      inject: [PUBLICATION_COORDINATOR],
    },
    {
      provide: PUBLIC_READ_PORT,
      useFactory: (database: DatabaseService) => new PostgresPublicReadRepository(database),
      inject: [DatabaseService],
    },
  ],
  exports: [PUBLICATION_PORT, PUBLIC_READ_PORT],
})
export class PublicationModule {}
