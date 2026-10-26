import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  typedRoutes: true,
  transpilePackages: ["@zhipanda/api-client"],
};

export default nextConfig;
