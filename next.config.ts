import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB is too tight for image-upload forms (team/club logos,
      // sponsor logos, player photos) — the Club form alone can submit two
      // images in one request.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
