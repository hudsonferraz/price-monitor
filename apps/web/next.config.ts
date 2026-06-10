import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@price-monitor/database", "@price-monitor/shared"],
};

export default nextConfig;
