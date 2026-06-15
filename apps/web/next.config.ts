import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@price-monitor/database", "@price-monitor/shared", "@price-monitor/queue"],
};

export default nextConfig;
