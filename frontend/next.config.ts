import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Note: API proxying is handled by /app/api/[...proxy]/route.ts
  // which properly forwards cookies to the backend.
  // Do NOT use rewrites() here as they cannot modify headers for external URLs.
};

export default nextConfig;
