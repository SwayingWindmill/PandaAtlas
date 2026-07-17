import type { Map as PublicMap, MapOptions } from "maplibre-gl";

export const Map: new (options: MapOptions) => PublicMap;
export function setWorkerUrl(value: string): void;
