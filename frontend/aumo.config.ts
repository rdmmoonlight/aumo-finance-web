import type { NextConfig } from 'next'

const aumoConfig: NextConfig = {
  output: 'standalone',
  // Konfigurasi proxy / rewrite untuk API backend
  async rewrites() {
    const backendTarget = process.env.WEB_API_URL || 'http://localhost:5000'
    return [
      {
        source: '/api/:path*',
        destination: `${backendTarget}/api/:path*`,
      },
    ]
  },
}

export default aumoConfig
