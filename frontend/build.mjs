import * as esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const isDev = process.argv.includes('--watch');

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
    'process.env': '{}'
  },
  sourcemap: true,
  minify: !isDev,
});

if (isDev) {
  await ctx.watch();
  
  // Menjalankan esbuild internal server
  const esbuildServer = await ctx.serve({
    servedir: 'public',
  });

  // Proxy HTTP Server bawaan Node.js untuk SPA Fallback (seperti Nginx try_files)
  const PORT = 3000;
  http.createServer((req, res) => {
    const url = req.url || '/';
    const filePath = path.join(process.cwd(), 'public', url.split('?')[0]);

    // Jika file fisik ada (bundle.js, bundle.css, favicon, dll), teruskan ke esbuild server
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
      // Untuk semua URL Rute SPA (seperti /guardian, /dashboard, /reports/*), kirim index.html
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
