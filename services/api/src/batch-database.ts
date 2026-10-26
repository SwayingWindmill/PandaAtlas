/** Batch adapters reach a remote database over verified TLS only; a local test database may skip it. */
export function assertVerifiedDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!local && !process.env.DATABASE_SSL_CA_CERT?.trim()) {
    throw new Error(`DATABASE_SSL_CA_CERT is required to reach ${host} over verified TLS.`);
  }
}
