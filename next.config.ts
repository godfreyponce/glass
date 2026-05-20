import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't infer it from an unrelated
  // lockfile elsewhere on the machine (it picked up ~/Desktop/pnpm-lock.yaml).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
