import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const demoEntry = '/preview/mini-group-card-preview.html';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mini-group-card-preview-root',
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
    port: 5183,
    strictPort: true,
    allowedHosts: true,
  },
  define: { 'process.env': {} },
});
