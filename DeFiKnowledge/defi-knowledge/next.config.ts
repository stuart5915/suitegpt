import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      '@lib': path.resolve(__dirname, '../lib'),
    },
  },
};

export default nextConfig;
