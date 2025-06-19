/** @type {import('next').NextConfig} */
const path = require('path');     // eslint-disable-line @typescript-eslint/no-require-imports

const nextConfig = {
  // Deaktiviere Strict Mode in der Entwicklung, um Mounting-Logs zu reduzieren
  reactStrictMode: process.env.NODE_ENV === 'production',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'www.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      jotai: path.resolve(process.cwd(), 'node_modules/jotai'),
    };
    return config;
  },
  // Reduziere Logging in der Entwicklung
  logging: {
    fetches: {
      fullUrl: false
    }
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Wenn keine Clerk Keys vorhanden sind, deaktiviere das statische Prerendering
  ...(process.env.NEXT_RUNTIME === 'build' || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? {
    output: 'standalone',
  } : {})
}

module.exports = nextConfig