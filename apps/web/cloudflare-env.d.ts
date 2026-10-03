interface CloudflareEnv {
  V2_API: { fetch: (input: Request) => Promise<Response> };
}
