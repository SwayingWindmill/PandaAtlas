import vinextWorker from "vinext/server/app-router-entry";
import { createWorker } from "./create-worker.mjs";

export default createWorker(vinextWorker);
