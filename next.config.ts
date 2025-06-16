import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Handle FFmpeg modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Configure FFmpeg specific modules
    config.resolve.alias = {
      ...config.resolve.alias,
      "@ffmpeg/ffmpeg": "@ffmpeg/ffmpeg/dist/ffmpeg.min.js",
    };

    return config;
  },
  // Add headers for SharedArrayBuffer support (required for FFmpeg)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
