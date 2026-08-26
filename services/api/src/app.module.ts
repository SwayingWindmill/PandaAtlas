import { Module } from "@nestjs/common";
import { EvidenceModule } from "./modules/evidence/evidence.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { LifeHistoryModule } from "./modules/life-history/life-history.module.js";
import { LineageModule } from "./modules/lineage/lineage.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { PandaModule } from "./modules/panda/panda.module.js";
import { PlacesModule } from "./modules/places/places.module.js";
import { ConfigModule } from "./platform/config/config.module.js";
import { HealthModule } from "./platform/health/health.module.js";
import { HttpPlatformModule } from "./platform/http/http-platform.module.js";

@Module({
  imports: [
    ConfigModule,
    HttpPlatformModule,
    HealthModule,
    IdentityModule,
    EvidenceModule,
    PandaModule,
    PlacesModule,
    LifeHistoryModule,
    LineageModule,
    MediaModule,
  ],
})
export class AppModule {}
