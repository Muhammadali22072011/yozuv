/** @type {import('next').NextConfig} */
const BACKEND_LOCAL = process.env.BACKEND_LOCAL_URL || "http://localhost:8000";

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/webhook/:path*",
        destination: `${BACKEND_LOCAL}/webhook/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_LOCAL}/health`,
      },
    ];
  },
};

export default nextConfig;
