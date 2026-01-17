import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['canvas', 'fabric', 'jsdom'],
};

export default nextConfig;
