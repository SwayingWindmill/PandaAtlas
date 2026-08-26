import { FastifyOtelInstrumentation } from "@fastify/otel";
import { registerOTel } from "@vercel/otel";

export function registerObservability(): void {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "zhipanda-api",
    instrumentations: [
      new FastifyOtelInstrumentation({
        registerOnInitialization: true,
        instrumentHooks: false,
      }),
    ],
  });
}
