import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const demoEntry = '/preview/cover-color-settings-preview.html';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cover-color-settings-preview-root',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url === '/' || request.url?.startsWith('/?')) {
            request.url = demoEntry;
          }
          next();
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5198,
    strictPort: true,
    allowedHosts: true,
  },
  define: { 'process.env': {} },
});
