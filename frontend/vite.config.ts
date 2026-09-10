import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // BACA SEMUA VARIABEL DARI .env TANPA PREFIX (PREFIX SAMA DENGAN '')
  const env = loadEnv(mode, process.cwd(), '');

  // PROSES SUNTIKAN VARIABEL KE process.env & import.meta.env
  const processEnvValues = Object.keys(env).reduce((prev, key) => {
    prev[`process.env.${key}`] = JSON.stringify(env[key]);
    prev[`import.meta.env.${key}`] = JSON.stringify(env[key]);
    return prev;
  }, {} as Record<string, string>);

  return {
    plugins: [react()],
    // Menggunakan define untuk bypass pembatasan envPrefix milik Vite
    define: processEnvValues,
    resolve: {
      alias: {
        // Menggunakan import.meta.dirname untuk menghilangkan warning Vite 8
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 3000,
      open: true,
    },
    build: {
      outDir: 'dist',
    },
  };
});