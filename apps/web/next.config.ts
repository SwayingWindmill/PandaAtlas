import type { NextConfig } from "next";

const productionSmokeDistDir = process.env.PANDA_NEXT_DIST_DIR
  ?? (process.env.npm_lifecycle_event === "build:production-smoke" ? ".next-production-smoke" : undefined);

const nextConfig: NextConfig = {
  typedRoutes: true,
  ...(productionSmokeDistDir ? { distDir: productionSmokeDistDir } : {}),
  transpilePackages: ["maplibre-gl"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos"
      }
    ]
  },
  webpack(config, { isServer }) {
    config.module.rules.push({
      resourceQuery: /maplibre-worker/,
      type: "asset/resource",
      generator: {
        filename: "static/map/[name].[contenthash][ext]"
      }
    });

    if (!isServer && config.optimization?.splitChunks && typeof config.optimization.splitChunks !== "boolean") {
      const splitChunks = config.optimization.splitChunks;
      splitChunks.cacheGroups = {
        ...splitChunks.cacheGroups,
        maplibreVisualization: {
          test: /[\\/]node_modules[\\/]maplibre-gl[\\/]src[\\/]/,
          chunks: "async",
          name: false,
          priority: 45,
          enforce: true,
          minSize: 0,
          maxSize: 420_000
        }
      };
    }

    return config;
  }
};

export default nextConfig;
