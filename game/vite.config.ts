import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

function gitShort() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); }
  catch { return 'dev'; }
}

export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsDir: 'js', chunkSizeWarningLimit: 2000, sourcemap: false },
  define: {
    __PI_BUILD__: JSON.stringify(gitShort()),
  },
  server: {
    host: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  },
  preview: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  },
});
