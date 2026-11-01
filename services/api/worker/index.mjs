import "reflect-metadata";
import { httpServerHandler } from "cloudflare:node";

const { createApplication } = await import("../dist/bootstrap.js");
const { DatabaseService } = await import("../dist/platform/database/database.service.js");
const { AsyncDownstreamRunnerService } = await import("../dist/jobs/async-downstream-runner.service.js");
const { runScheduledCycle } = await import("../dist/jobs/scheduled-cycle.js");
const { webPublicCache } = await import("../dist/jobs/web-public-cache.js");
const { StructuredLoggerService } = await import("../dist/platform/observability/structured-logger.service.js");
const { AskRuntimeService } = await import("../dist/modules/ask/infrastructure/cloudflare-ask-runtime.js");
const { AskIndexSyncService } = await import("../dist/modules/ask/infrastructure/ask-index-sync.service.js");
const { createColdStartReporter } = await import("../dist/platform/observability/cold-start.js");
const application = await createApplication();
const database = application.get(DatabaseService);
const runner = application.get(AsyncDownstreamRunnerService);
const logger = application.get(StructuredLoggerService);
const askRuntime = application.get(AskRuntimeService);
const askIndexSync = application.get(AskIndexSyncService);
const bridge = httpServerHandler(application.getHttpServer());
const coldStart = createColdStartReporter(logger);

export default {
  fetch(request, bindings, context) {
    coldStart.report("fetch", { method: request.method, path: new URL(request.url).pathname });
    return askRuntime.withBindings(bindings, () =>
      database.withRequest(bindings.HYPERDRIVE.connectionString, () =>
        bridge.fetch(request, bindings, context),
      ),
    );
  },
  scheduled(_controller, bindings, context) {
    coldStart.report("scheduled");
    // waitUntil records a failed cycle as the Cron Trigger invocation status.
    context.waitUntil(runScheduledCycle(database, runner, bindings.HYPERDRIVE.connectionString, {
      publicCache: webPublicCache(bindings.PUBLIC_WEB),
    }, logger));
    // A separate waitUntil: the Ask Panda index sync logs its own failures and never fails the cycle.
    context.waitUntil(database.withRequest(bindings.HYPERDRIVE.connectionString, () => askIndexSync.run(bindings)));
  },
};
