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
import { PublicReadCache } from "../public-read/infrastructure/public-read-cache.js";
import { PublicReadModule } from "../public-read/public-read.module.js";
import {
  PUBLICATION_CHANGE_PORT,
  type PublicationChangePort,
} from "./application/publication-change.port.js";
import {
  PUBLICATION_INSPECTION_PORT,
  type PublicationInspectionPort,
} from "./application/publication-inspection.port.js";
import {
  PUBLICATION_COORDINATOR,
  PUBLICATION_PORT,
  PublicationApplication,
  type PublicationCoordinator,
} from "./application/publication.application.js";
import { PublicationController } from "./http/publication.controller.js";
import { PostgresPublicationChangeQuery } from "./infrastructure/postgres-publication-change.query.js";
import { PostgresPublicationCoordinator } from "./infrastructure/postgres-publication.coordinator.js";
import { PostgresPublicationInspectionQuery } from "./infrastructure/postgres-publication-inspection.query.js";

@Module({
  imports: [
    DatabaseModule,
    IntegrationModule,
    RequestContextModule,
    PublicReadModule,
    EvidenceModule,
    PandaModule,
    PlacesModule,
    LifeHistoryModule,
    LineageModule,
    MediaModule,
  ],
  controllers: [PublicationController],
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
        cache: PublicReadCache,
      ) => new PostgresPublicationCoordinator(database, outbox, evidence, pandas, places, lifeHistory, lineage, media, cache),
      inject: [
        DatabaseService,
        IntegrationOutboxService,
        EVIDENCE_PUBLICATION_PORT,
        PANDA_PUBLICATION_PORT,
        PLACES_PUBLICATION_PORT,
        LIFE_HISTORY_PUBLICATION_PORT,
        LINEAGE_PUBLICATION_PORT,
        MEDIA_PUBLICATION_PORT,
        PublicReadCache,
      ],
    },
    {
      provide: PUBLICATION_PORT,
      useFactory: (coordinator: PublicationCoordinator) => new PublicationApplication(coordinator),
      inject: [PUBLICATION_COORDINATOR],
    },
    { provide: PUBLICATION_CHANGE_PORT, useFactory: () => new PostgresPublicationChangeQuery() },
    {
      provide: PUBLICATION_INSPECTION_PORT,
      useFactory: (database: DatabaseService, changes: PublicationChangePort): PublicationInspectionPort =>
        new PostgresPublicationInspectionQuery(database, changes),
      inject: [DatabaseService, PUBLICATION_CHANGE_PORT],
    },
  ],
  exports: [PUBLICATION_PORT, PUBLICATION_CHANGE_PORT, PUBLICATION_INSPECTION_PORT],
})
export class PublicationModule {}
