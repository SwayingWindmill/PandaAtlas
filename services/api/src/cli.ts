import "reflect-metadata";
import { createApplication } from "./bootstrap.js";
import { registerObservability } from "./instrumentation.js";
import { AppConfig } from "./platform/config/app-config.js";

registerObservability();

const app = await createApplication();
const config = app.get(AppConfig);
await app.listen(config.port, config.host);
