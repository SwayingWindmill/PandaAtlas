import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { EvidenceModule } from "../evidence/evidence.module.js";
import { EVIDENCE_PORT, type EvidencePort } from "../evidence/application/evidence.application.js";
import {
  PANDA_CURATION_PARTICIPANT,
  PANDA_REFERENCE_PORT,
  type PandaCurationParticipant,
  type PandaReferencePort,
} from "../panda/application/panda.application.js";
import { PandaModule } from "../panda/panda.module.js";
import {
  CURATION_APPLY_COORDINATOR,
  CURATION_INTAKE_PORT,
  CURATION_PORT,
  CURATION_REPOSITORY,
  CurationApplication,
  type CurationApplyCoordinator,
  type CurationRepository,
} from "./application/curation.application.js";
import { CurationController } from "./http/curation.controller.js";
import { PostgresCurationApplyCoordinator } from "./infrastructure/postgres-curation-apply.coordinator.js";
import { PostgresCurationRepository } from "./infrastructure/postgres-curation.repository.js";

@Module({
  imports: [DatabaseModule, EvidenceModule, PandaModule],
  controllers: [CurationController],
  providers: [
    {
      provide: PostgresCurationRepository,
      useFactory: (database: DatabaseService) => new PostgresCurationRepository(database),
      inject: [DatabaseService],
    },
    { provide: CURATION_REPOSITORY, useExisting: PostgresCurationRepository },
    {
      provide: PostgresCurationApplyCoordinator,
      useFactory: (
        database: DatabaseService,
        repository: PostgresCurationRepository,
        pandas: PandaCurationParticipant,
      ) => new PostgresCurationApplyCoordinator(database, repository, pandas),
      inject: [DatabaseService, PostgresCurationRepository, PANDA_CURATION_PARTICIPANT],
    },
    { provide: CURATION_APPLY_COORDINATOR, useExisting: PostgresCurationApplyCoordinator },
    {
      provide: CurationApplication,
      useFactory: (
        repository: CurationRepository,
        applyCoordinator: CurationApplyCoordinator,
        pandas: PandaReferencePort,
        evidence: EvidencePort,
      ) => new CurationApplication(repository, applyCoordinator, pandas, evidence),
      inject: [CURATION_REPOSITORY, CURATION_APPLY_COORDINATOR, PANDA_REFERENCE_PORT, EVIDENCE_PORT],
    },
    { provide: CURATION_PORT, useExisting: CurationApplication },
    { provide: CURATION_INTAKE_PORT, useExisting: CurationApplication },
  ],
  exports: [CURATION_PORT, CURATION_INTAKE_PORT],
})
export class CurationModule {}
