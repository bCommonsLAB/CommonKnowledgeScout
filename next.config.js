/** @type {import('next').NextConfig} */
const path = require('path');     // eslint-disable-line @typescript-eslint/no-require-imports

const nextConfig = {
  // Standalone-Output für Package-Build (nur wenn nicht Windows oder Admin-Rechte)
  output: process.env.IS_PACKAGE_BUILD === 'true' && process.platform !== 'win32' ? 'standalone' : undefined,
  
  // Deaktiviere Strict Mode in der Entwicklung, um Mounting-Logs zu reduzieren
  reactStrictMode: process.env.NODE_ENV === 'production',
  
  // Package-spezifische Umgebungsvariablen
  env: {
    BUILD_TARGET: process.env.BUILD_TARGET || 'web',
    IS_PACKAGE_BUILD: process.env.IS_PACKAGE_BUILD || 'false'
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
  
  // Webpack-Konfiguration für Package-Build
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      jotai: path.resolve(process.cwd(), 'node_modules/jotai'),
    };
    
    // Package-spezifische Optimierungen
    if (process.env.IS_PACKAGE_BUILD === 'true') {
      config.externals = config.externals || [];
      
      // Electron-spezifische Module ausschließen für Package-Build
      config.externals.push('electron');
      
      // Optimierungen für Package-Build
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 500000,
        }
      };
    }
    
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
    esmExternals: 'loose',
  },
  
  // ESLint und TypeScript-Checks nur für Package-Build deaktivieren
  eslint: {
    ignoreDuringBuilds: process.env.IS_PACKAGE_BUILD === 'true',
  },
  
  typescript: {
    ignoreBuildErrors: process.env.IS_PACKAGE_BUILD === 'true',
  }
}

module.exports = nextConfig