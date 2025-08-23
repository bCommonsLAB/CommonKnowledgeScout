/** @type {import('next').NextConfig} */
const path = require('path'); // eslint-disable-line @typescript-eslint/no-require-imports

const nextConfig = {
  output: process.env.IS_PACKAGE_BUILD === 'true' && process.platform !== 'win32' ? 'standalone' : undefined,
  reactStrictMode: process.env.NODE_ENV === 'production',
  env: {
    BUILD_TARGET: process.env.BUILD_TARGET || 'web',
    IS_PACKAGE_BUILD: process.env.IS_PACKAGE_BUILD || 'false'
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'www.youtube.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      jotai: path.resolve(process.cwd(), 'node_modules/jotai'),
    };
    if (process.env.IS_PACKAGE_BUILD === 'true') {
      config.externals = config.externals || [];
      config.externals.push('electron');
      config.optimization = {
        ...config.optimization,
        splitChunks: { chunks: 'all', minSize: 20000, maxSize: 500000 },
      };
    }
    return config;
  },
  logging: { fetches: { fullUrl: false } },
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  eslint: { ignoreDuringBuilds: process.env.IS_PACKAGE_BUILD === 'true' },
  typescript: { ignoreBuildErrors: process.env.IS_PACKAGE_BUILD === 'true' },
};

module.exports = nextConfig;
