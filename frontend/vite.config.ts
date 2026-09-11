import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  envPrefix: 'WEB_',
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { cssMinify: false },
  server: {
    host: 'localhost',
    port: 3000,
  },
})
