import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@/src': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/composables': path.resolve(__dirname, './src/composables'),
      '@/plugins': path.resolve(__dirname, './src/plugins'),
      '@': path.resolve(__dirname, './'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'pinia', 'vue-i18n'],
          'ai-vendor': ['@google/genai', 'openai'],
          'pdf-vendor': ['pdf-parse', 'jspdf', 'mammoth', 'docx'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    exclude: ['pdf-parse'],
  },
});
