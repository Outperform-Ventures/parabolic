import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {offlinePlugin} from './scripts/offline-plugin';
const apiTarget = `http://127.0.0.1:${Number(process.env.PARABOLIC_DEV_API_PORT || 4174)}`;
export default defineConfig({
  plugins: [react(),offlinePlugin()],
  server: { port: 4173, strictPort: true, watch:{ignored:['**/.local/**','**/release/**','**/dist/**','**/dist-desktop/**','**/reference/**','**/artifacts/**','**/test-results/**']}, proxy: { '/api': apiTarget, '/auth': apiTarget, '/graphql': apiTarget, '/oauth': {target:apiTarget,bypass(req){if(req.method==='GET'&&req.url?.startsWith('/oauth/authorize')&&req.headers.accept?.includes('text/html')&&!req.headers.accept?.includes('application/json'))return '/index.html';}}, '/collaboration': {target:apiTarget,ws:true}, '/mcp': apiTarget, '/.well-known': apiTarget, '/public': apiTarget, '/calendar': apiTarget, '/asks-api': apiTarget } },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 650 },
});
