import "reflect-metadata";
import { createApplication } from "./bootstrap.js";
import { AppConfig } from "./platform/config/app-config.js";

const app = await createApplication();
const config = app.get(AppConfig);
await app.listen(config.port, config.host);
