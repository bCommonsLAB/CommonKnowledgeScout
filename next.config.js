/** @type {import('next').NextConfig} */
const path = require('path');     // eslint-disable-line @typescript-eslint/no-require-imports

const nextConfig = {
  // Deaktiviere Strict Mode in der Entwicklung, um Mounting-Logs zu reduzieren
  reactStrictMode: process.env.NODE_ENV === 'production',
  
  // Standalone output für Electron-Kompatibilität
    output: 'standalone',
  
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
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
  
  // Environment Variables für Build-Target
  env: {
    BUILD_TARGET: process.env.BUILD_TARGET || 'web',
    ELECTRON: process.env.ELECTRON === 'true' ? 'true' : 'false'
  }
}

module.exports = nextConfig