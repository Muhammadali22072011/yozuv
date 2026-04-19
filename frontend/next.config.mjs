/** @type {import('next').NextConfig} */
const API_UPSTREAM =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_UPSTREAM}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
