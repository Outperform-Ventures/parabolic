import { ParabolicClient } from '../../packages/sdk/src/client.js';
import { createMcpHttpServer, serveStdio } from './server.js';
import { COLLECTIONS, type Collection } from '../../packages/sdk/src/types.js';

const baseUrl = process.env.PARABOLIC_URL ?? 'http://127.0.0.1:4174';
const collections = process.env.PARABOLIC_MCP_COLLECTIONS?.split(',').filter(Boolean) as Collection[] | undefined;
if (collections?.some(kind => !COLLECTIONS.includes(kind))) throw new Error('PARABOLIC_MCP_COLLECTIONS contains an unknown collection');
const readOnly = process.env.PARABOLIC_MCP_READ_ONLY === '1';
if (process.argv.includes('--http')) {
  const service = createMcpHttpServer({ baseUrl, collections, readOnly, host: process.env.PARABOLIC_MCP_HOST ?? '127.0.0.1', port: Number(process.env.PARABOLIC_MCP_PORT ?? 4041), allowedOrigins: process.env.PARABOLIC_MCP_ORIGINS?.split(',').filter(Boolean) });
  const { url } = await service.start(); process.stderr.write(`Parabolic MCP listening at ${url}\n`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void service.close().then(() => process.exit(0)); });
} else {
  const token = process.env.PARABOLIC_API_TOKEN;
  if (!token) { process.stderr.write('PARABOLIC_API_TOKEN is required for stdio MCP\n'); process.exit(1); }
  serveStdio({ client: new ParabolicClient({ baseUrl, token }), collections, readOnly });
}
