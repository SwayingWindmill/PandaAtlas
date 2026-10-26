import { Module, type INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigModule } from "../../platform/config/config.module.js";
import { PUBLICATION_INSPECTION_PORT } from "./application/publication-inspection.port.js";
import { PUBLICATION_PORT } from "./application/publication.application.js";
import type { ReleaseCommandPorts } from "./application/release-command.js";
import { PublicationModule } from "./publication.module.js";

/** Only what the release batch adapters use: configuration and the publication module, no HTTP server. */
@Module({ imports: [ConfigModule, PublicationModule] })
class ReleaseCommandModule {}

export async function createReleaseCommandContext(): Promise<{ app: INestApplicationContext; ports: ReleaseCommandPorts }> {
  const app = await NestFactory.createApplicationContext(ReleaseCommandModule, { logger: ["error", "warn"] });
  return { app, ports: { publication: app.get(PUBLICATION_PORT), inspection: app.get(PUBLICATION_INSPECTION_PORT) } };
}
