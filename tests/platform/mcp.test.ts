import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { ParabolicClient } from '../../packages/sdk/src/client.js';
import { createMcpHandler, createMcpHttpServer, serveStdio } from '../../src/mcp/server.js';
const rpc = (method: string, params?: unknown, id = 1) => ({ jsonrpc: '2.0', id, method, params });
const mockClient = (status = 200) => new ParabolicClient({ baseUrl: 'http://localhost:4040', maxRetries: 0, fetch: (async () => new Response(JSON.stringify(status === 200 ? { id: 'issue-1', title: 'Test' } : { error: 'Forbidden' }), { status })) as typeof fetch });
test('MCP initialize, schemas, collection restrictions and read-only tools', async () => {
  const handler = createMcpHandler({ client: mockClient(), collections: ['issues', 'projects'], readOnly: true });
  const init = await handler.handle(rpc('initialize', { protocolVersion: '2025-03-26' })) as any;
  assert.equal(init.result.protocolVersion, '2025-03-26'); assert.equal(init.result.serverInfo.name, 'parabolic');
  const tools = await handler.handle(rpc('tools/list')) as any;
  assert.deepEqual(tools.result.tools.map((tool: any) => tool.name), ['list_entities', 'get_entity', 'search']);
  assert.equal((await handler.handle(rpc('tools/call', { name: 'create_entity', arguments: { kind: 'issues', fields: { title: 'Test' } } })) as any).error.code, -32602);
  assert.equal((await handler.handle(rpc('tools/call', { name: 'get_entity', arguments: { kind: 'users', id: 'u1' } })) as any).error.code, -32602);
  const success = await handler.handle(rpc('tools/call', { name: 'get_entity', arguments: { kind: 'issues', id: 'issue-1' } })) as any;
  assert.equal(success.result.structuredContent.result.id, 'issue-1');
});
test('MCP reports upstream permission errors without claiming tool success', async () => {
  const handler = createMcpHandler({ client: mockClient(403) });
  const result = await handler.handle(rpc('tools/call', { name: 'update_entity', arguments: { kind: 'issues', id: 'i1', fields: { title: 'Edit' } } })) as any;
  assert.equal(result.result.isError, true); assert.match(result.result.content[0].text, /403: Forbidden/);
  assert.equal((await handler.handle(rpc('tools/call', { name: 'list_entities', arguments: { kind: 'issues', first: -1 } })) as any).error.code, -32602);
  assert.equal((await handler.handle({ jsonrpc: '2.0', id: {}, method: 'ping' }) as any).error.code, -32600);
  assert.equal(await handler.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), undefined);
});
test('MCP resource reads enforce allowlist and invalid methods produce JSON-RPC errors', async () => {
  const handler = createMcpHandler({ client: mockClient(), collections: ['issues'] });
  const schema = await handler.handle(rpc('resources/read', { uri: 'parabolic://schema' })) as any;
  assert.deepEqual(JSON.parse(schema.result.contents[0].text).collections, ['issues']);
  assert.equal((await handler.handle(rpc('resources/read', { uri: 'parabolic://users/u1' })) as any).error.code, -32602);
  assert.equal((await handler.handle(rpc('unknown')) as any).error.code, -32601);
});
test('MCP stdio uses newline JSON only and recovers from malformed input', async () => {
  const input = new PassThrough(); const output = new PassThrough(); let text = '';
  output.on('data', chunk => { text += chunk.toString(); });
  const instance = serveStdio({ client: mockClient(), input, output });
  input.write('not json\n'); input.write(`${JSON.stringify(rpc('ping'))}\n`);
  await new Promise(resolve => setImmediate(resolve));
  const lines = text.trim().split('\n').map(line => JSON.parse(line)); assert.equal(lines.length, 2); assert.equal(lines[0].error.code, -32700); assert.deepEqual(lines[1].result, {});
  instance.close(); input.end(); output.end();
});
test('MCP HTTP authenticates, rejects cross-origin requests, handles notifications', async () => {
  const server = createMcpHttpServer({ baseUrl: 'http://localhost:4040', port: 0, fetch: (async (_url, init) => new Response(JSON.stringify({ active:new Headers(init?.headers).get('authorization') === 'Bearer valid',scopes:['read','write'] }))) as typeof fetch });
  const { url } = await server.start();
  const headers = { Authorization: 'Bearer valid', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  try {
    assert.equal((await fetch(url, { method: 'POST', body: JSON.stringify(rpc('ping')), headers: { ...headers, Authorization: 'Bearer invalid' } })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', body: JSON.stringify(rpc('ping')), headers: { ...headers, Origin: 'https://malicious.example' } })).status, 403);
    const result = await fetch(url, { method: 'POST', body: JSON.stringify(rpc('ping')), headers }); assert.deepEqual(await result.json(), { jsonrpc: '2.0', id: 1, result: {} });
    assert.equal((await fetch(url, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), headers })).status, 202);
    assert.equal((await fetch(url, { headers })).status, 405);
  } finally { await server.close(); }
});

test('MCP search forwards bounded title and filter options without widening collections',async()=>{
  let seen:any;const handler=createMcpHandler({client:{collection:()=>{throw Error('Unexpected collection');},search:async(query,options)=>{seen={query,options};return {nodes:[],totalCount:0};}},collections:['issues']});
  const result=await handler.handle(rpc('tools/call',{name:'search',arguments:{query:'',filter:{priority:1},first:500,orderBy:'updatedAt',includeArchived:false,titleOnly:true}})) as any;assert.equal(result.error,undefined);assert.deepEqual(seen.options.kinds,['issues']);assert.equal(seen.query,'');assert.equal(seen.options.first,500);assert.deepEqual(seen.options.filter,{priority:1});assert.equal(seen.options.includeArchived,false);assert.equal(seen.options.titleOnly,true);
  assert.equal((await handler.handle(rpc('tools/call',{name:'search',arguments:{query:'find',kinds:['projects']}})) as any).error.code,-32602);assert.equal((await handler.handle(rpc('tools/call',{name:'search',arguments:{query:'find',first:501}})) as any).error.code,-32602);assert.equal((await handler.handle(rpc('tools/call',{name:'search',arguments:{query:'find',titleOnly:'true'}})) as any).error.code,-32602);
});
