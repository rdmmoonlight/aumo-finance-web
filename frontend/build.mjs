import * as esbuild from 'esbuild';

const isDev = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outfile: 'public/bundle.js',
  loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
  define: { 'process.env.NODE_ENV': isDev ? '"development"' : '"production"' },
  sourcemap: true,
  minify: !isDev,
});

if (isDev) {
  await ctx.watch();
  const { host, port } = await ctx.serve({
    servedir: 'public',
    port: 3000,
  });
  console.log(`⚡ Aumo Finance dev server berjalan di http://${host}:${port}`);
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('✅ Build production selesai!');
}
