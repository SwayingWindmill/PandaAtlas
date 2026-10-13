import { RequestMethod, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ExpressAdapter, type NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { AppConfig } from "./platform/config/app-config.js";
import { StructuredLoggerService } from "./platform/observability/structured-logger.service.js";

const BODY_LIMIT = "1mb";

// The API serves JSON only, so nothing it returns may load resources or be framed.
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
};

// Express, not Fastify: the Workers runtime forbids `new Function` and has no timers outside a
// request, both of which Fastify's boot relies on (#524).
export async function configureApplication(
  app: NestExpressApplication,
): Promise<NestExpressApplication> {
  app.useLogger(app.get(StructuredLoggerService));
  const config = app.get(AppConfig);

  app.disable("x-powered-by");
  app.use((_request: IncomingMessage, response: ServerResponse, next: () => void) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.setHeader(name, value);
    next();
  });
  app.useBodyParser("json", { limit: BODY_LIMIT });
  app.setGlobalPrefix("api", {
    exclude: [
      { path: "health", method: RequestMethod.GET },
      { path: "ready", method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "2",
  });
  app.enableCors({
    origin: config.corsAllowOrigins,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.init();
  return app;
}

export async function createApplication(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    bufferLogs: true,
  });
  return configureApplication(app);
}
