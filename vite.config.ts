import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Optimize chunk sizes
        rollupOptions: {
          output: {
            manualChunks: {
              // Separate vendor libraries into their own chunks
              'recharts': ['recharts'],
              'xlsx': ['xlsx'],
              'idb': ['idb'],
              'lucide': ['lucide-react'],
            }
          }
        },
        // Increase chunk size warning limit to 500KB since we're splitting
        chunkSizeWarningLimit: 600,
        // Use default minification (esbuild)
        minify: 'esbuild'
      }
    };
});
