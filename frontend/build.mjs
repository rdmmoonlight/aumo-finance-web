import * as esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const isDev = process.argv.includes('--watch');

// Membaca API_BASE_URL dari environment variable
const apiBaseUrl = process.env.API_BASE_URL || 'https://aumonext-api.onrender.com';

const ctx = await esbuild.context({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  format: 'esm',
  outfile: 'public/bundle.js',
  loader: { 
    '.tsx': 'tsx', 
    '.ts': 'ts', 
    '.css': 'css',
    '.woff': 'file',
    '.woff2': 'file',
    '.ttf': 'file',
    '.svg': 'file'
  },
  define: { 
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
    'process.env.API_BASE_URL': JSON.stringify(apiBaseUrl),
    'import.meta.env.API_BASE_URL': JSON.stringify(apiBaseUrl),
    'import.meta.env.MODE': isDev ? '"development"' : '"production"',
    'import.meta.env.DEV': isDev ? 'true' : 'false',
    'import.meta.env.PROD': isDev ? 'false' : 'true',
  },
  sourcemap: isDev,
  minify: !isDev,
});

if (isDev) {
  await ctx.watch();
  
  // Menjalankan esbuild internal server
  const esbuildServer = await ctx.serve({
    servedir: 'public',
  });

  const PORT = 3000;
  http.createServer((req, res) => {
    const url = req.url || '/';
    const cleanUrl = url.split('?')[0];
    const filePath = path.join(process.cwd(), 'public', cleanUrl);

    // Jika request mencari file fisik di public (bundle.js, bundle.css, favicon, dll)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const options = {
        hostname: esbuildServer.host,
        port: esbuildServer.port,
        path: req.url,
        method: req.method,
        headers: req.headers,
      };

      const proxyReq = http.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      req.pipe(proxyReq, { end: true });
    } else {
      // SPA Fallback: Arahkan rute aplikasi ke public/index.html
      fs.readFile(path.join(process.cwd(), 'public', 'index.html'), (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading index.html');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    }
  }).listen(PORT, () => {
    console.log(`⚡ Aumo Finance dev server (SPA Mode) berjalan di http://localhost:${PORT}`);
  });

} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('✅ Build production selesai!');
}
