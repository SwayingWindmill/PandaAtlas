// The Web edge caches public pages; any change to what is publicly delivered purges that cache.
export interface PublicCachePort {
  purge(): Promise<void>;
}
