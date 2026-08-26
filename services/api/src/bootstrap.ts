import { RequestMethod, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import { AppConfig } from "./platform/config/app-config.js";

const BODY_LIMIT_BYTES = 1_048_576;

export async function createApplication(): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({ bodyLimit: BODY_LIMIT_BYTES });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  const config = app.get(AppConfig);

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
