interface CloudflareEnv {
  V2_API: { fetch: (input: Request) => Promise<Response> };
}

declare module "cloudflare:workers" {
  export const env: CloudflareEnv;
}
