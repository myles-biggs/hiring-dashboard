import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@levelinteractive/ui",
    "@levelinteractive/notifications",
    "@levelinteractive/types",
  ],
  typescript: {
    // Suppress type errors originating in @levelinteractive source packages
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
