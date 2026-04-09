import { build, context } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/content/main.ts'],
  bundle: true,
  outfile: 'dist/content.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
};

function copyAssets() {
  mkdirSync('dist', { recursive: true });
  cpSync('src/manifest.json', 'dist/manifest.json');
  cpSync('src/icons', 'dist/icons', { recursive: true });
}

if (isWatch) {
  const ctx = await context(buildOptions);
  copyAssets();
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(buildOptions);
  copyAssets();
  console.log('Build complete.');
}
