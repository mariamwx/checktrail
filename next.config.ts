import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep old invite URLs working while UI lives under /ui/*
  async rewrites() {
    return [
      { source: "/game.html", destination: "/ui/category1/index.html" },
      { source: "/category2.html", destination: "/ui/category2/index.html" },
    ];
  },
};

export default nextConfig;
