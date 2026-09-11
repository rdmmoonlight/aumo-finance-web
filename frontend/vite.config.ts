import { defineConfig } from 'vite'
import path from 'path'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  build: {
    target: 'esnext', // <- WAJIB INI
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    tsconfigPaths(),
    tanstackStart({
      customViteReactPlugin: true,
    }),
    nitroV2Plugin({ 
      preset: 'vercel',
      compatibilityDate: '2025-11-01',
    }),
    viteReact(),
    tailwindcss(),
  ],
})