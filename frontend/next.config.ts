import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root is the backend's npm workspace; this app is a separate project rooted here.
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
