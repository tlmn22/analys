import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.16.0.124"],
  async headers() {
    return [{ source: "/sw.js", headers: [
      { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
    ] }];
  },
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
