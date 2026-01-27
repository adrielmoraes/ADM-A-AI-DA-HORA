/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.replit.dev', '*.replit.app', '*.repl.co'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
