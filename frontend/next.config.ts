import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Note: API proxying is now handled by /app/api/[...proxy]/route.ts
  // The rewrite has been removed because it was conflicting with the API route
};

export default nextConfig;
