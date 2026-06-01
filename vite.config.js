import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  resolve: {
    alias: {
      '@noble/post-quantum/ml-kem-768': '@noble/post-quantum'
    }
  },
  build: {
    target: 'es2015',
    outDir: 'src',
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/app.js'),
      output: {
        entryFileNames: 'bundle.js',
        format: 'iife',
        inlineDynamicImports: true
      }
    },
    commonjsOptions: {
      include: [/libsodium-wrappers/, /@noble\/post-quantum/, /node_modules/]
    }
  },
  optimizeDeps: {
    include: ['libsodium-wrappers', '@noble/post-quantum']
  }
});
