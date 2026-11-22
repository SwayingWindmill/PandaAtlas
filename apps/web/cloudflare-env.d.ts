interface CloudflareEnv {
  V2_API: { fetch: (input: Request) => Promise<Response> };
  AUTH_OTP_RATE_LIMIT?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
}

declare module "cloudflare:workers" {
  export const env: CloudflareEnv;
}
