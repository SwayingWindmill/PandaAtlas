import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { AuditModule } from "./modules/audit/audit.module.js";
import { NotificationModule } from "./modules/notification/notification.module.js";
import { PrivacyModule } from "./modules/privacy/privacy.module.js";
import { PublicationModule } from "./modules/publication/publication.module.js";
import { UpdatesModule } from "./modules/updates/updates.module.js";

function normalizeOpenApi31Nullable(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) normalizeOpenApi31Nullable(item);
    return;
  }
  if (value === null || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  if (typeof record.nullable === "boolean") {
    const nullable = record.nullable;
    delete record.nullable;
    if (nullable) {
      if (typeof record.type === "string") {
        record.type = [record.type, "null"];
      } else if (typeof record.$ref === "string") {
        const reference = record.$ref;
        delete record.$ref;
        record.anyOf = [{ $ref: reference }, { type: "null" }];
      }
    }
  }
  for (const nested of Object.values(record)) normalizeOpenApi31Nullable(nested);
}

export function createV2OpenApiDocument(app: NestFastifyApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("PandaAtlas V2 API")
    .setDescription("Canonical NestJS V2 HTTP contract for release-scoped public reads and bounded downstream product APIs.")
    .setVersion("2.0.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "supabaseJwt")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [PublicationModule, UpdatesModule, NotificationModule, PrivacyModule, AuditModule],
    deepScanRoutes: false,
  });
  normalizeOpenApi31Nullable(document);

  return { ...document, openapi: "3.1.0" };
}
