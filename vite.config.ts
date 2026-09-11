import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {offlinePlugin} from './scripts/offline-plugin';
export default defineConfig({
  plugins: [react(),offlinePlugin()],
  server: { port: 4173, strictPort: true, watch:{ignored:['**/release/**','**/dist/**','**/dist-desktop/**','**/reference/**','**/artifacts/**','**/test-results/**']}, proxy: { '/api': 'http://127.0.0.1:4174', '/auth': 'http://127.0.0.1:4174', '/graphql': 'http://127.0.0.1:4174', '/oauth': {target:'http://127.0.0.1:4174',bypass(req){if(req.method==='GET'&&req.url?.startsWith('/oauth/authorize')&&req.headers.accept?.includes('text/html')&&!req.headers.accept?.includes('application/json'))return '/index.html';}}, '/collaboration': {target:'http://127.0.0.1:4174',ws:true}, '/mcp': 'http://127.0.0.1:4174', '/.well-known': 'http://127.0.0.1:4174', '/public': 'http://127.0.0.1:4174' } },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 650 },
});
