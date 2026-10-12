import "reflect-metadata";
import { httpServerHandler } from "cloudflare:node";

const { createApplication } = await import("../dist/bootstrap.js");
const { DatabaseService } = await import("../dist/platform/database/database.service.js");
const { AsyncDownstreamRunnerService } = await import("../dist/jobs/async-downstream-runner.service.js");
const { runScheduledCycle } = await import("../dist/jobs/scheduled-cycle.js");
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
  scheduled(_controller, bindings) {
    return runScheduledCycle(database, runner, bindings.HYPERDRIVE.connectionString);
  },
};
