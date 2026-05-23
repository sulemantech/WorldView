import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cesium workers need these headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
  // Disable static export — Cesium loads from CDN, needs headers
  output: undefined,
};

export default nextConfig;
