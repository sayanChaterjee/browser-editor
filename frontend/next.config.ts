import path from "path";
import type { NextConfig } from "next";

// Sent with every response; pages also get a nonce-based Content-Security-Policy (middleware.ts)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // The repo root is the backend's npm workspace; this app is a separate project rooted here.
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingRoot: path.join(__dirname),

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The preview runs the user's code, so it gets no script restrictions; only this app
        // may frame it. It is always loaded sandboxed (opaque origin), see components/PreviewFrame.
        source: "/preview-frame.html",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
    ];
  },
};

export default nextConfig;
