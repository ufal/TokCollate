import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import type { Connect } from 'vite'

const serveFilesPlugin = () => {
  return {
    name: 'serve-local-files',
    configureServer(server: any) {
      return () => {
        server.middlewares.use((req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) => {
          const url = req.url || '';
          
          // Skip API routes - let them be handled by proxy
          if (url.startsWith('/api')) {
            return next();
          }
          
          console.log('[serve-local-files] Incoming request:', url);
          
          // Check if URL looks like an absolute filesystem path
          // Matches patterns like /home/..., /root/..., /tmp/..., /mnt/..., /var/...
          const absolutePathPattern = /^(\/home\/|\/root\/|\/tmp\/|\/mnt\/|\/var\/)/;
          
          if (absolutePathPattern.test(url)) {
            const filePath = decodeURIComponent(url);
            
            console.log('[serve-local-files] Attempting to serve file:', filePath);
            
            try {
              if (fs.existsSync(filePath)) {
                console.log('[serve-local-files] File found, serving:', filePath);
                const fileContent = fs.readFileSync(filePath);
                const ext = path.extname(filePath);
                let contentType = 'application/octet-stream';
                
                if (ext === '.json') {
                  contentType = 'application/json; charset=utf-8';
                } else if (ext === '.npz') {
                  contentType = 'application/octet-stream';
                }
                
                res.setHeader('Content-Type', contentType);
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Content-Length', fileContent.length);
                res.writeHead(200);
                res.end(fileContent);
                return;
              } else {
                console.log('[serve-local-files] File not found:', filePath);
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found: ' + filePath }));
                return;
              }
            } catch (err) {
              console.error('[serve-local-files] Error serving file:', filePath, err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Error reading file: ' + String(err) }));
              return;
            }
          }
          
          next();
        });
      };
    },
  };
};

export default defineConfig({
  plugins: [react(), serveFilesPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
