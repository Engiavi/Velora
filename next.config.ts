import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // experimental: {
    serverExternalPackages: [
      'sharp',
      'onnxruntime-node',
      '@huggingface/transformers',
      '@datastax/astra-db-ts'
    ],
  // },
};

export default nextConfig;
