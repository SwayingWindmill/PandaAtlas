import "reflect-metadata";
import { httpServerHandler } from "cloudflare:node";

const { createApplication } = await import("../dist/bootstrap.js");
const { DatabaseService } = await import("../dist/platform/database/database.service.js");
const { AsyncDownstreamRunnerService } = await import("../dist/jobs/async-downstream-runner.service.js");
const { runScheduledCycle } = await import("../dist/jobs/scheduled-cycle.js");
const { webPublicCache } = await import("../dist/jobs/web-public-cache.js");
const application = await createApplication();
const database = application.get(DatabaseService);
const runner = application.get(AsyncDownstreamRunnerService);
const bridge = httpServerHandler(application.getHttpServer());

export default {
  fetch(request, bindings, context) {
    return database.withRequest(bindings.HYPERDRIVE.connectionString, () =>
      bridge.fetch(request, bindings, context),
    );
  },
  scheduled(_controller, bindings, context) {
    // waitUntil records a failed cycle as the Cron Trigger invocation status.
    context.waitUntil(runScheduledCycle(database, runner, bindings.HYPERDRIVE.connectionString, {
      publicCache: webPublicCache(bindings.PUBLIC_WEB),
    }));
  },
};
