import { defineConfig } from 'vite'
import path from 'path'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    tsconfigPaths(),
    tanstackStart({
      target: 'vercel',
      customViteReactPlugin: true,
    }),
    viteReact(),
    tailwindcss(),
  ],
})