import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ParabolicClient, ApiError, GraphQLRequestError } from '../../packages/sdk/src/client.js';
import { verifyWebhook, WebhookVerificationError } from '../../packages/sdk/src/webhooks.js';

const response = (data: unknown, status = 200, headers: HeadersInit = {}) => new Response(status === 204 ? undefined : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
test('SDK encodes filters and ids and resolves rotating bearer tokens', async () => {
  const calls: { url: string; init?: RequestInit }[] = []; let token = 'first';
  const sdk = new ParabolicClient({ baseUrl: 'http://localhost:4040/', token: () => token, fetch: (async (url, init) => { calls.push({ url: String(url), init }); return response({ nodes: [], totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null } }); }) as typeof fetch });
  await sdk.issues.list({ first: 20, filter: { status: { eq: 'Todo' } }, orderBy: 'updatedAt' }); token = 'second';
  await sdk.issues.get('id/with space');
  const url = new URL(calls[0].url); assert.deepEqual(JSON.parse(url.searchParams.get('filter')!), { status: { eq: 'Todo' } }); assert.equal(url.searchParams.get('first'), '20');
  assert.equal(new Headers(calls[0].init?.headers).get('authorization'), 'Bearer first');
  assert.equal(new Headers(calls[1].init?.headers).get('authorization'), 'Bearer second');
  assert.match(calls[1].url, /id%2Fwith%20space$/); assert.equal(calls[0].init?.credentials, 'include');
  await assert.rejects(() => sdk.request('//host.example'), TypeError);
});
test('SDK retries transient reads and never retries mutations', async () => {
  let reads = 0;
  const sdk = new ParabolicClient({ baseUrl: 'http://localhost', fetch: (async (_url, init) => { if (init?.method === 'GET') return ++reads === 1 ? response({ error: 'Busy' }, 503, { 'Retry-After': '0' }) : response({ id: 'one' }); return response({ error: { message: 'Conflict', code: 'conflict' }, details: { expected: 2 } }, 409, { 'X-Request-ID': 'request1' }); }) as typeof fetch });
  assert.equal((await sdk.issues.get('one')).id, 'one'); assert.equal(reads, 2);
  await assert.rejects(() => sdk.issues.update('one', { title: 'Edited' }), (error: any) => error instanceof ApiError && error.status === 409 && error.code === 'conflict' && error.requestId === 'request1');
});
test('SDK paginates and detects repeated cursors', async () => {
  let calls = 0;
  const sdk = new ParabolicClient({ baseUrl: 'http://localhost', fetch: (async () => response({ nodes: [{ id: String(++calls) }], totalCount: 3, pageInfo: { hasNextPage: true, endCursor: 'stuck' } })) as typeof fetch });
  const iterator = sdk.issues.iterate(); assert.equal((await iterator.next()).value?.id, '1'); assert.equal((await iterator.next()).value?.id, '2');
  await assert.rejects(() => iterator.next(), /cursor did not advance/);
});
test('SDK preserves GraphQL errors and partial data', async () => {
  const sdk = new ParabolicClient({ baseUrl: 'http://localhost', fetch: (async () => response({ data: { issue: null }, errors: [{ message: 'Forbidden', path: ['issue'] }] })) as typeof fetch });
  await assert.rejects(() => sdk.graphql('{issue{id}}'), (error: any) => error instanceof GraphQLRequestError && error.errors[0].path?.[0] === 'issue' && (error.data as any).issue === null);
});
test('SDK cancellation reaches fetch without retrying', async () => {
  let calls = 0; const abort = new AbortController();
  const sdk = new ParabolicClient({ baseUrl: 'http://localhost', fetch: (async (_url, init) => { calls++; return new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true }); }); }) as typeof fetch });
  const result = sdk.issues.get('one', { signal: abort.signal }); abort.abort(new Error('Stopped'));
  await assert.rejects(result, /Stopped/); assert.equal(calls, 1);
});
test('SDK cancellation and deadlines cover pending token providers before opening requests or streams',async()=>{
 let fetches=0,providers=0;const client=new ParabolicClient({baseUrl:'http://localhost',token:()=>{providers++;return new Promise<string>(()=>{});},fetch:(async()=>{fetches++;return response({});}) as typeof fetch});
 const controller=new AbortController(),pending=client.issues.list({}, {signal:controller.signal});controller.abort(new Error('Credential request canceled'));await assert.rejects(pending,/Credential request canceled/);assert.equal(fetches,0);
 const streamAbort=new AbortController(),iterator=client.events({signal:streamAbort.signal}),next=iterator.next();streamAbort.abort(new Error('Stream canceled before authentication'));await assert.rejects(next,/Stream canceled before authentication/);assert.equal(fetches,0);
 // AbortSignal.timeout uses an unref'ed timer in Node; keep the test alive through its deadline.
 const keepAlive=setTimeout(()=>{},1000);try{await assert.rejects(client.issues.list({}, {timeoutMs:10}),error=>error instanceof DOMException&&error.name==='TimeoutError');}finally{clearTimeout(keepAlive);}
 const calls=providers,already=new AbortController();already.abort(new Error('Already canceled'));await assert.rejects(client.issues.list({}, {signal:already.signal}),/Already canceled/);assert.equal(providers,calls);assert.equal(fetches,0);
});
test('SDK event stream handles chunk splits, CRLF, heartbeat and cancellation cleanup', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('event: access\ndata: {"accessRevision":9}\n\n: heartbeat\r\n\r\ndata: {"kind":"iss')); controller.enqueue(new TextEncoder().encode('ues","action":"update","id":"x","seq":4}\r\n\r\n')); }, cancel() { cancelled = true; } });
  const sdk = new ParabolicClient({ baseUrl: 'http://localhost', token: 'test', fetch: (async (_url, init) => { assert.equal(new Headers(init?.headers).get('Last-Event-ID'), '3'); return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }); }) as typeof fetch });
  let revision=0;for await (const event of sdk.events({ lastEventId: '3' })) {if(event.event==='access'){revision=event.accessRevision;continue;} assert.equal(event.seq, 4); break; }
  assert.equal(revision,9);
  assert.equal(cancelled, true);
});
test('Webhook verification validates exact raw bytes and replay timestamp', () => {
  const now = 1800000000000; const secret = 'test secret'; const body = JSON.stringify({ webhookTimestamp: now, action: 'create', data: { id: 'test' } });
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyWebhook({ body, secret, signature, now }).action, 'create');
  for (const overrides of [{ body: `${body} ` }, { secret: 'wrong' }, { signature: 'bad' }, { now: now + 300001 }, { now: now - 300001 }]) assert.throws(() => verifyWebhook({ body, secret, signature, now, ...overrides }), WebhookVerificationError);
});
