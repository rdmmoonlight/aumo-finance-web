import { defineConfig } from 'vite'
import path from 'path'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  build: { target: 'esnext' },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  plugins: [
    tsconfigPaths(),
    tanstackStart({ customViteReactPlugin: true }),
    nitro({ config: { preset: 'vercel', compatibilityDate: '2025-11-01' } }),
    viteReact(),
    tailwindcss(),
  ],
})