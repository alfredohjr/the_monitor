import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint runs in CI — skip during Docker build to avoid blocking on warnings
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
