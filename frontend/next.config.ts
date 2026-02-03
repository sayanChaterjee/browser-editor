import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // All /api/* requests go through /app/api/[...proxy]/route.ts for cookie forwarding
  // This includes both /api/auth/* (OAuth, session) and /api/v1/* (API endpoints)
};

export default nextConfig;
