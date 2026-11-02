import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsDir: 'js', chunkSizeWarningLimit: 2000, sourcemap: false },
  server: { host: true }
});
