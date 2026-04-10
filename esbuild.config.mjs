import { build, context } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

import packageJson from './package.json' with { type: 'json' };

const isWatch = process.argv.includes('--watch');

function resolveBuildSha() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7);
  }

  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'local';
  }
}

const buildSha = resolveBuildSha();
const buildTimestamp = new Date().toISOString();

const buildOptions = {
  entryPoints: {
    content: 'src/content/main.ts',
    background: 'src/background.ts',
  },
  bundle: true,
  outdir: 'dist',
  entryNames: '[name]',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  define: {
    __EXT_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    __RELEASES_PAGE_URL__: JSON.stringify('https://github.com/jenarvaezg/coinscope/releases'),
  },
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
