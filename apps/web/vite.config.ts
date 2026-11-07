/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Compile @nexus/shared from TypeScript source so the browser build always
// matches the workspace code (the published-style output is CJS for Node).
const sharedSource = fileURLToPath(new URL('../../packages/shared/src', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@nexus/shared': sharedSource,
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: the app code changes every release, the libraries do not, so returning visitors
        // keep them cached and each page chunk stays small.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/.test(id)) return 'vendor-i18n';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
