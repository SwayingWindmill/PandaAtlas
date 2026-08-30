import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import { configureApplication, createHttpAdapter } from "./bootstrap.js";

const app = await NestFactory.create<NestFastifyApplication>(AppModule, createHttpAdapter(), {
  bufferLogs: true,
});
await configureApplication(app);
const fastify = app.getHttpAdapter().getInstance();
await fastify.ready();

export default function handler(request: IncomingMessage, response: ServerResponse): void {
  fastify.routing(request, response);
}
