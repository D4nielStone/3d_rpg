import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        app: `${root}/index.html`,
        mapEditor: `${root}/map-editor.html`,
      },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/cannon-es/')) return 'physics';
          return undefined;
        },
      },
    },
  },
});
