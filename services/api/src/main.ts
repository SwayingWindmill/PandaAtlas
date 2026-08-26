import "reflect-metadata";
import { registerObservability } from "./instrumentation.js";

registerObservability();

const [{ createApplication }, { AppConfig }] = await Promise.all([
  import("./bootstrap.js"),
  import("./platform/config/app-config.js"),
]);

const app = await createApplication();
const config = app.get(AppConfig);
await app.listen(config.port, config.host);
