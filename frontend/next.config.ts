import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        // BFF Proxy: Route all /api/* requests through Vercel to Render backend
        // This makes the browser think all API traffic is same-origin
        // Enables sameSite=Lax cookies for maximum security
        source: '/api/:path*',
        destination: 'https://api-gateway-rq2x.onrender.com/api/:path*',
      },
    ];
  },
};

export default nextConfig;
