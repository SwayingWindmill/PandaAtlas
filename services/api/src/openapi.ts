import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { PublicationModule } from "./modules/publication/publication.module.js";

export function createV2OpenApiDocument(app: NestFastifyApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("PandaAtlas V2 API")
    .setDescription("Canonical NestJS V2 HTTP contract. The public-read surface is release-scoped and PostgreSQL-backed.")
    .setVersion("2.0.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "supabaseJwt")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [PublicationModule],
    deepScanRoutes: true,
  });

  return { ...document, openapi: "3.1.0" };
}
