export const PUBLIC_CACHE_INVALIDATION_PORT = Symbol("PUBLIC_CACHE_INVALIDATION_PORT");

export interface PublicCacheInvalidationPort {
  purgePublicRead(): Promise<void>;
}
