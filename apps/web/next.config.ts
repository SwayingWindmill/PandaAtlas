import type { NextConfig } from "next";

const productionSmokeDistDir = process.env.PANDA_NEXT_DIST_DIR
  ?? (process.env.npm_lifecycle_event === "build:production-smoke" ? ".next-production-smoke" : undefined);

const nextConfig: NextConfig = {
  typedRoutes: true,
  ...(productionSmokeDistDir ? { distDir: productionSmokeDistDir } : {}),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos"
      }
    ]
  }
};

export default nextConfig;
