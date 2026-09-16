import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export is the default assumption for Vercel/Netlify free-tier
  // hosting per ROADMAP.md Track A - no server-only features are used, so
  // this stays deployable on either host without code changes.
  reactStrictMode: true,
};

export default nextConfig;
