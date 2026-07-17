import { Map } from "maplibre-gl/src/ui/map.ts";
import { config } from "maplibre-gl/src/util/config.ts";

function setWorkerUrl(value) {
  config.WORKER_URL = value;
}

export { Map, setWorkerUrl };
