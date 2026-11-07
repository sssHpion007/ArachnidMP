import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const demoEntry = '/preview/theme-palette-preview.html';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'theme-palette-preview-root',
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
    port: 5182,
    strictPort: true,
    allowedHosts: true,
  },
  define: { 'process.env': {} },
});
