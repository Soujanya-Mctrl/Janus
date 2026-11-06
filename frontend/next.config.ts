import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  // External macOS volumes create AppleDouble sidecars that Turbopack's
  // persistent database may parse as numeric cache entries. Compile in memory.
  experimental: {
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
