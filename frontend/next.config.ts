import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep generated files isolated from stale caches created by other Node runtimes.
  distDir: ".next-fgcscout",
  output: "standalone",
};

export default nextConfig;
