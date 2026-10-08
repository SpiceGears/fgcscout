import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const scriptSources = isDevelopment
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : "'self' 'unsafe-inline'";
const connectSources = isDevelopment
  ? "'self' http://localhost:5000 ws: wss:"
  : "'self'";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src ${scriptSources} https://www.youtube.com/iframe_api https://www.youtube.com/s/player/`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "font-src 'self' data:",
  `connect-src ${connectSources}`,
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
].join("; ");
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Keep generated files isolated from stale caches created by other Node runtimes.
  distDir: ".next-fgcscout",
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${apiProxyTarget}/health`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
