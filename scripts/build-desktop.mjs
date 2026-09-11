import { build } from 'esbuild';

await Promise.all([
  build({ entryPoints: ['src/desktop/service.ts'], outfile: 'dist-desktop/service.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node24', sourcemap: true }),
  build({ entryPoints: ['src/desktop/main.ts'], outfile: 'dist-desktop/main.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['electron'], sourcemap: true }),
  build({ entryPoints: ['src/desktop/preload.ts'], outfile: 'dist-desktop/preload.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['electron'], sourcemap: true }),
  build({ entryPoints: ['src/mcp/cli.ts'], outfile: 'dist-mcp/cli.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node24', sourcemap: true }),
]);
