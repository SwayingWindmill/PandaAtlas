import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter, type NestExpressApplication } from "@nestjs/platform-express";
import path from "node:path";
import { AppModule } from "./app.module.js";
import { configureApplication } from "./bootstrap.js";
import { E2eFixtureGuard, assertE2eFixtureEnvironment } from "./e2e-fixture/e2e-fixture.guard.js";
import { E2eFixtureModule } from "./e2e-fixture/e2e-fixture.module.js";
import { AppConfig } from "./platform/config/app-config.js";

// Development and E2E-only server entrypoint. Production (`cli.ts`, `worker/index.mjs`) never imports this module.
@Module({ imports: [AppModule, E2eFixtureModule] })
export class E2eFixtureAppModule {}

export async function createE2eFixtureApplication(): Promise<NestExpressApplication> {
  assertE2eFixtureEnvironment(
    process.env.APP_ENV ?? "development",
    process.env.HOST ?? "0.0.0.0",
    process.env.E2E_FIXTURE_TOKEN,
  );
  const app = await NestFactory.create<NestExpressApplication>(
    E2eFixtureAppModule,
    new ExpressAdapter(),
    { bufferLogs: true },
  );
  // Force guard resolution at startup so misconfigured tokens fail fast before listening.
  app.get(E2eFixtureGuard);
  return configureApplication(app);
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith("e2e-fixture-server")) {
  const app = await createE2eFixtureApplication();
  const config = app.get(AppConfig);
  await app.listen(config.port, config.host);
}
