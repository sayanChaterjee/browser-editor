import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // NOTE: Rewrites removed because Next.js rewrites don't forward cookies to external URLs
  // All /api/* requests now go through /app/api/[...proxy]/route.ts which properly forwards cookies
};

export default nextConfig;
