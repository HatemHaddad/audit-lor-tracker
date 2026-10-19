import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["botbuilder", "@prisma/client", "mammoth", "xlsx"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
