import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const demoEntry = '/preview/play-icon-color-preview.html';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'play-icon-color-preview-root',
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
    port: 5199,
    strictPort: true,
    allowedHosts: true,
  },
  define: { 'process.env': {} },
});
