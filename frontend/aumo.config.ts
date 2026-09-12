import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load variabel lingkungan berdasarkan mode (development/production)
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.WEB_API_URL || 'http://localhost:5000'

  return {
    plugins: [
      devtools(),
      nitro(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
    server: {
      // Proxy untuk lingkungan development (lokal)
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  }
})
    
