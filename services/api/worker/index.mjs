import "reflect-metadata";
import { httpServerHandler } from "cloudflare:node";

const { createApplication } = await import("../dist/bootstrap.js");
const { DatabaseService } = await import("../dist/platform/database/database.service.js");
const application = await createApplication();
const database = application.get(DatabaseService);
const bridge = httpServerHandler(application.getHttpServer());

export default {
  fetch(request, bindings, context) {
    return database.withRequest(bindings.HYPERDRIVE.connectionString, () =>
      bridge.fetch(request, bindings, context),
    );
  },
};
