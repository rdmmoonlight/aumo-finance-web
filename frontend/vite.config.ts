import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig(({ mode }) => {
  // Load environment variables berdasarkan mode (development/production)
  const env = loadEnv(mode, process.cwd(), '')

  // Ambil URL backend dari .env (bisa VITE_WEB_API_URL atau variabel lain)
  const backendTarget = env.VITE_WEB_API_URL || 'http://localhost:5000'

  return {
    plugins: [devtools(), nitro(), tailwindcss(), tanstackStart(), viteReact()],
    server: {
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      tsconfigPaths: true,
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
      dedupe: ['react', 'react-dom', '@tanstack/react-router'],
    },
  }
})