import { RequestMethod, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter, type NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { AppConfig } from "./platform/config/app-config.js";
import { PinoLoggerService } from "./platform/observability/pino-logger.service.js";

const BODY_LIMIT = "1mb";

// Express, not Fastify: the Workers runtime forbids `new Function` and has no timers outside a
// request, both of which Fastify's boot relies on (#524).
export async function configureApplication(
  app: NestExpressApplication,
): Promise<NestExpressApplication> {
  app.useLogger(app.get(PinoLoggerService));
  const config = app.get(AppConfig);

  app.disable("x-powered-by");
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
