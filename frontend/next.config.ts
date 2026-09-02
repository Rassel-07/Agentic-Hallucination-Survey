import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.129',
    '192.168.1.*',
    '192.168.*.*',
    '0.0.0.0',
    'local-origin.dev',
    '*.local-origin.dev',
  ],
};

export default nextConfig;
