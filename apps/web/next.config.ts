import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  typedRoutes: true,
  transpilePackages: ["@zhipanda/api-client", "maplibre-gl"],
};

export default nextConfig;
