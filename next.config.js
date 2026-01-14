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
    // Für Kompatibilität: domains (veraltet, aber manchmal noch benötigt)
    domains: ['www.sfscon.it', 'ragtempproject.blob.core.windows.net'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'www.youtube.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'www.sfscon.it', pathname: '/**' },
      { protocol: 'https', hostname: 'ragtempproject.blob.core.windows.net', pathname: '/**' },
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      jotai: path.resolve(process.cwd(), 'node_modules/jotai'),
    };
    
    // MongoDB und Node.js-spezifische Module nur auf dem Server verfügbar machen
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        fs: false,
        dns: false,
        child_process: false,
        'mongodb-client-encryption': false,
      };
      
      // MongoDB-Module explizit externalisieren (werden nicht im Browser-Bundle gebündelt)
      config.externals = config.externals || [];
      config.externals.push({
        'mongodb': 'commonjs mongodb',
        'mongodb-client-encryption': 'commonjs mongodb-client-encryption',
      });
    }
    
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
