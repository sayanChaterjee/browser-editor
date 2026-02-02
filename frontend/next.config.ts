import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        // Proxy all /api/auth/* requests to Render backend
        // This makes the browser think backend is same-origin
        source: '/api/auth/:path*',
        destination: 'https://api-gateway-rq2x.onrender.com/api/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
