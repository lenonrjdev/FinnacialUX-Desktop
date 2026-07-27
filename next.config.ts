import type { NextConfig } from "next";

const internalHost = process.env.TAURI_DEV_HOST || "localhost";
const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  assetPrefix: isDevelopment ? `http://${internalHost}:3000` : undefined,
};

export default nextConfig;
