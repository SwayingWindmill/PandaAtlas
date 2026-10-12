import type { INestApplication } from "@nestjs/common";
import inject, { type DispatchFunc, type InjectOptions, type Response } from "light-my-request";

// In-process HTTP requests against the Nest Express server, replacing Fastify's app.inject().
export function injectHttp(app: INestApplication, options: InjectOptions): Promise<Response> {
  return inject(app.getHttpAdapter().getInstance() as DispatchFunc, options);
}
