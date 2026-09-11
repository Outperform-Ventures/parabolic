import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { ApiError, ParabolicClient } from '../../packages/sdk/src/client.js';
import { COLLECTIONS, type Collection } from '../../packages/sdk/src/types.js';

export interface McpClient {
  collection(kind:Collection): {get(id:string,options?:any):Promise<any>;list(options?:any,request?:any):Promise<any>;create(fields:any,options?:any):Promise<any>;update(id:string,fields:any,options?:any):Promise<any>;remove(id:string,options?:any):Promise<any>;restore(id:string,options?:any):Promise<any>};
  search(query:string,options?:any):Promise<any>;
}
type RpcId = string | number | null;
type RpcRequest = { jsonrpc: '2.0'; id?: RpcId; method: string; params?: Record<string, any> };
type RpcResponse = { jsonrpc: '2.0'; id: RpcId; result?: unknown; error?: { code: number; message: string; data?: unknown } };
export interface McpOptions {
  client: McpClient;
  /** Further restrict the upstream API credential. Server permissions always apply. */
  collections?: Collection[];
  readOnly?: boolean;
}
const objectSchema = { type: 'object', additionalProperties: true };
const names = ['list_entities', 'get_entity', 'search', 'create_entity', 'update_entity', 'delete_entity', 'restore_entity'] as const;
const readNames = new Set(['list_entities', 'get_entity', 'search']);
const protocols = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'];
const error = (id: RpcId, code: number, message: string, data?: unknown): RpcResponse => ({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } });
const validId = (id: unknown): id is RpcId => id === null || typeof id === 'string' || typeof id === 'number';

export function createMcpHandler(options: McpOptions) {
  const kinds = [...new Set(options.collections ?? COLLECTIONS)];
  for (const kind of kinds) if (!COLLECTIONS.includes(kind)) throw new TypeError(`Unsupported collection: ${kind}`);
  const kindSchema = { type: 'string', enum: kinds };
  const schemas = {
    list_entities: { description: 'List accessible workspace records with filters and cursor pagination. Set includeDeleted to discover records in trash.', properties: { kind: kindSchema, first: { type: 'integer', minimum: 1, maximum: 500 }, after: { type: 'string' }, last:{type:'integer',minimum:1,maximum:500},before:{type:'string'}, filter: objectSchema, orderBy: { type: 'string' },includeDeleted:{type:'boolean'} }, required: ['kind'] },
    get_entity: { description: 'Read one accessible workspace record by ID.', properties: { kind: kindSchema, id: { type: 'string' } }, required: ['kind', 'id'] },
    search: { description: 'Search accessible workspace records, including issue comments. Supports exact quoted phrases, issue ID shorthand, compound filters, archived records, and title-only quick-open. Use an empty query with a nonempty filter.', properties: { query: { type: 'string', maxLength: 1000 }, kinds: { type: 'array', items: kindSchema }, first: { type: 'integer', minimum: 1, maximum: 500 }, after: { type: 'string' },filter:objectSchema,orderBy:{type:'string'},includeArchived:{type:'boolean'},titleOnly:{type:'boolean'} }, required: ['query'] },
    create_entity: { description: 'Create a workspace record. Requires upstream write permission.', properties: { kind: kindSchema, fields: objectSchema }, required: ['kind', 'fields'] },
    update_entity: { description: 'Update a workspace record. Include version for optimistic conflict checks.', properties: { kind: kindSchema, id: { type: 'string' }, fields: objectSchema }, required: ['kind', 'id', 'fields'] },
    delete_entity: { description: 'Move a workspace record to trash. Requires upstream write permission.', properties: { kind: kindSchema, id: { type: 'string' } }, required: ['kind', 'id'] },
    restore_entity: { description: 'Restore a trashed workspace record.', properties: { kind: kindSchema, id: { type: 'string' } }, required: ['kind', 'id'] },
  };
  const tools = names.filter(name => !options.readOnly || readNames.has(name)).map(name => ({
    name, description: schemas[name].description,
    inputSchema: { type: 'object', properties: schemas[name].properties, required: schemas[name].required, additionalProperties: false },
    annotations: { readOnlyHint: readNames.has(name), destructiveHint: name === 'delete_entity', idempotentHint: readNames.has(name) || name === 'delete_entity', openWorldHint: false },
  }));
  const pending = new Map<RpcId, AbortController>();
  const requireKind = (value: unknown): Collection => { if (typeof value !== 'string' || !kinds.includes(value as Collection)) throw new TypeError('kind is not an allowed collection'); return value as Collection; };
  const requireString = (value: unknown, name: string): string => { if (typeof value !== 'string' || !value.trim() || value.length > 10_000) throw new TypeError(`${name} must be a nonempty string`); return value; };
  const requireFields = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('fields must be an object'); return value as Record<string, unknown>; };
  async function handle(input: unknown): Promise<RpcResponse | RpcResponse[] | undefined> {
    if (Array.isArray(input)) {
      if (!input.length || input.length > 100) return error(null, -32600, 'Invalid batch');
      const results = (await Promise.all(input.map(handle))).flat().filter(Boolean) as RpcResponse[];
      return results.length ? results : undefined;
    }
    if (!input || typeof input !== 'object') return error(null, -32600, 'Invalid Request');
    const request = input as RpcRequest;
    const id = validId(request.id) ? request.id : null;
    if (request.jsonrpc !== '2.0' || typeof request.method !== 'string' || ('id' in request && !validId(request.id))) return error(id, -32600, 'Invalid Request');
    const notification = request.id === undefined;
    if (request.method === 'notifications/cancelled') { pending.get(request.params?.requestId)?.abort(); return undefined; }
    if (notification) return undefined;
    const controller = new AbortController(); pending.set(id, controller);
    const params = request.params ?? {};
    try {
      let result: unknown;
      switch (request.method) {
        case 'initialize': result = { protocolVersion: protocols.includes(params.protocolVersion) ? params.protocolVersion : '2025-11-25', capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } }, serverInfo: { name: 'parabolic', version: '0.1.0' }, instructions: 'Internal workspace tools. API token permissions and collection restrictions apply. No hosted AI or agent execution is provided.' }; break;
        case 'ping': result = {}; break;
        case 'tools/list': result = { tools }; break;
        case 'resources/list': result = { resources: [{ uri: 'parabolic://schema', name: 'Workspace collections', description: 'Allowed collection names and API usage.', mimeType: 'application/json' }] }; break;
        case 'resources/templates/list': result = { resourceTemplates: [{ uriTemplate: 'parabolic://{kind}/{id}', name: 'Workspace record', mimeType: 'application/json' }] }; break;
        case 'resources/read': {
          const uri = requireString(params.uri, 'uri'); let data: unknown;
          if (uri === 'parabolic://schema') data = { collections: kinds, readOnly: !!options.readOnly, apiBase: '/api/v1', docs: 'Use tools/list for input schemas. Filters use JSON objects; writes accept record fields.' };
          else { const parsed = new URL(uri); if (parsed.protocol !== 'parabolic:') throw new TypeError('Unsupported resource URI'); data = await options.client.collection(requireKind(parsed.hostname)).get(requireString(decodeURIComponent(parsed.pathname.slice(1)), 'id'), { signal: controller.signal }); }
          result = { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data) }] }; break;
        }
        case 'tools/call': {
          const name = params.name as keyof typeof schemas;
          if (!tools.some(tool => tool.name === name)) return error(id, -32602, 'Unknown or disallowed tool');
          const args = params.arguments ?? {};
          if (!args || typeof args !== 'object' || Array.isArray(args)) throw new TypeError('arguments must be an object');
          const allowedKeys = Object.keys(schemas[name].properties);
          if (Object.keys(args).some(key => !allowedKeys.includes(key))) throw new TypeError('Unknown tool argument');
          const first = args.first;
          if (first !== undefined && (!Number.isInteger(first) || first < 1 || first > 500)) throw new TypeError('first is outside the allowed range');
          if (args.after !== undefined) requireString(args.after, 'after');
          if(args.last!==undefined&&(!Number.isInteger(args.last)||args.last<1||args.last>500))throw new TypeError('last is outside the allowed range');
          if(args.before!==undefined)requireString(args.before,'before');
          if(first!==undefined&&args.last!==undefined||args.after!==undefined&&args.before!==undefined)throw new TypeError('Use first/after or last/before pagination');
          if (args.orderBy !== undefined) requireString(args.orderBy, 'orderBy');
          if (args.filter !== undefined) requireFields(args.filter);
          if(args.includeDeleted!==undefined&&typeof args.includeDeleted!=='boolean')throw new TypeError('includeDeleted must be a boolean');
          for(const field of ['includeArchived','titleOnly'])if(args[field]!==undefined&&typeof args[field]!=='boolean')throw new TypeError(`${field} must be a boolean`);
          const req = { signal: controller.signal };
          let data: unknown;
          try {
            if (name === 'search') {
              if (args.kinds !== undefined && !Array.isArray(args.kinds)) throw new TypeError('kinds must be an array');
              if(typeof args.query!=='string'||args.query.length>1000)throw new TypeError('query must be a string of at most 1000 characters');
              data = await options.client.search(args.query, { kinds: args.kinds?.map(requireKind) ?? kinds, first, after: args.after,filter:args.filter,orderBy:args.orderBy,includeArchived:args.includeArchived,titleOnly:args.titleOnly, ...req });
            } else {
              const collection = options.client.collection(requireKind(args.kind));
              if (name === 'list_entities') data = await collection.list({ first, after: args.after,last:args.last,before:args.before, filter: args.filter, orderBy: args.orderBy,includeDeleted:args.includeDeleted }, req);
              else if (name === 'get_entity') data = await collection.get(requireString(args.id, 'id'), req);
              else if (name === 'create_entity') data = await collection.create(requireFields(args.fields), req);
              else if (name === 'update_entity') data = await collection.update(requireString(args.id, 'id'), requireFields(args.fields), req);
              else if (name === 'delete_entity') { await collection.remove(requireString(args.id, 'id'), req); data = { deleted: true, id: args.id }; }
              else data = await collection.restore(requireString(args.id, 'id'), req);
            }
          } catch (failure) {
            if (failure instanceof TypeError) throw failure;
            result = { isError: true, content: [{ type: 'text', text: failure instanceof ApiError ? `${failure.status}: ${failure.message}` : controller.signal.aborted ? 'Request cancelled' : failure instanceof Error ? failure.message : 'Tool request failed' }] }; break;
          }
          result = { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: { result: data } }; break;
        }
        default: return error(id, -32601, `Method not found: ${request.method}`);
      }
      return { jsonrpc: '2.0', id, result };
    } catch (failure) { return error(id, failure instanceof TypeError ? -32602 : -32603, failure instanceof Error ? failure.message : 'Internal error'); }
    finally { pending.delete(id); }
  }
  return { handle, tools };
}

export function serveStdio(options: McpOptions & { input?: Readable; output?: Writable }) {
  const handler = createMcpHandler(options);
  const input = createInterface({ input: options.input ?? process.stdin, crlfDelay: Infinity });
  const output = options.output ?? process.stdout;
  input.on('line', line => {
    void (async () => {
      let response: unknown;
      try { response = line.length > 2_000_000 ? error(null, -32600, 'Request too large') : await handler.handle(JSON.parse(line)); }
      catch { response = error(null, -32700, 'Parse error'); }
      if (response !== undefined) output.write(`${JSON.stringify(response)}\n`);
    })();
  });
  return { close: () => input.close() };
}

export interface McpCredential {client:McpClient;scopes:string[]}
export interface McpHttpHandlerOptions {
  resource:()=>string;
  authorizationServer?:()=>string;
  resolveCredential:(req:IncomingMessage,resource:string)=>Promise<McpCredential|null>|McpCredential|null;
  allowedOrigins?:string[];
  collections?:Collection[];
  readOnly?:boolean;
}
const sendHttp=(res:ServerResponse,status:number,body?:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body===undefined?undefined:JSON.stringify(body));};
/** Shared stateless Streamable HTTP transport. The embedded server resolves actors directly. */
export function createMcpHttpHandler(options:McpHttpHandlerOptions) {
  const kinds=options.collections??COLLECTIONS;
  return async(req:IncomingMessage,res:ServerResponse)=>{
    const resource=options.resource(),metadata=new URL('/.well-known/oauth-protected-resource/mcp',resource).href;
    const challenge=(status:number,errorName?:string,scopes:string[]=['read'])=>{
      res.setHeader('WWW-Authenticate',`Bearer ${errorName?`error="${errorName}", `:''}scope="${scopes.join(' ')}"${options.authorizationServer?`, resource_metadata="${metadata}"`:''}`);
      return sendHttp(res,status,{error:errorName??'unauthorized'});
    };
    const origin=req.headers.origin;
    if(origin&&origin!==new URL(resource).origin&&!options.allowedOrigins?.includes(origin))return sendHttp(res,403,{error:'Origin is not allowed'});
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Expose-Headers','WWW-Authenticate, MCP-Protocol-Version');}
    if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST, GET, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id');return sendHttp(res,204);}
    if(!req.headers.authorization?.match(/^Bearer [^\s]{1,4096}$/i))return challenge(401);
    const credential=await options.resolveCredential(req,resource);
    if(!credential)return challenge(401,'invalid_token');
    if(req.method!=='POST'){res.setHeader('Allow','POST, OPTIONS');return sendHttp(res,405,{error:'This endpoint uses stateless JSON responses'});}
    if(!req.headers['content-type']?.includes('application/json'))return sendHttp(res,415,{error:'Expected application/json'});
    if(!req.headers.accept?.includes('application/json')||!req.headers.accept?.includes('text/event-stream'))return sendHttp(res,406,{error:'Accept must include application/json and text/event-stream'});
    const version=req.headers['mcp-protocol-version'];if(version&&(typeof version!=='string'||!protocols.includes(version)))return sendHttp(res,400,{error:'Unsupported MCP protocol version'});
    const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2_000_000)return sendHttp(res,413,{error:'Request too large'});chunks.push(Buffer.from(chunk));}
    let body:any;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return sendHttp(res,400,error(null,-32700,'Parse error'));}
    if(Array.isArray(body))return sendHttp(res,400,error(null,-32600,'A Streamable HTTP request must contain one JSON-RPC message'));
    const scopes=credential.scopes,required:string[]=[];
    const requireScope=(kind:string,action:'read'|'write')=>{if(!scopes.includes('admin')&&!scopes.includes(action)&&!scopes.includes(`${kind}:${action}`))required.push(`${kind}:${action}`);};
    if(body?.method==='tools/call'){
      const name=body.params?.name,args=body.params?.arguments??{};
      if(names.includes(name)&&name!=='search'&&kinds.includes(args.kind))requireScope(args.kind,readNames.has(name)?'read':'write');
      if(name==='search'){
        const requested=Array.isArray(args.kinds)?args.kinds:kinds;
        if(Array.isArray(args.kinds)){for(const kind of requested)if(kinds.includes(kind))requireScope(kind,'read');}
        else if(!scopes.some(scope=>scope==='read'||scope==='admin'||scope.endsWith(':read')))required.push('read');
      }
    }
    if(body?.method==='resources/read'&&body.params?.uri!=='parabolic://schema')try{const uri=new URL(body.params?.uri);if(kinds.includes(uri.hostname as Collection))requireScope(uri.hostname,'read');}catch{/* JSON-RPC validation provides the error. */}
    if(required.length)return challenge(403,'insufficient_scope',[...new Set([...scopes,...required])]);
    const response=await createMcpHandler({client:credential.client,collections:options.collections,readOnly:options.readOnly}).handle(body);
    return sendHttp(res,response===undefined?202:200,response);
  };
}
export interface HttpMcpOptions {baseUrl:string;host?:string;port?:number;allowedOrigins?:string[];collections?:Collection[];readOnly?:boolean;fetch?:typeof fetch}
/** Compatibility bridge for personal API keys. OAuth clients use the workspace server's /mcp. */
export function createMcpHttpServer(options:HttpMcpOptions) {
  let resource='';
  const handle=createMcpHttpHandler({...options,resource:()=>resource,resolveCredential:async req=>{
    const client=new ParabolicClient({baseUrl:options.baseUrl,token:req.headers.authorization!.slice(7),fetch:options.fetch,maxRetries:0});
    try{const credential=await client.request<{active:boolean;scopes:string[]}>('/oauth/mcp-credential');return credential.active?{client,scopes:credential.scopes}:null;}catch{return null;}
  }});
  const server=createServer((req,res)=>{if(req.url?.split('?')[0]!=='/mcp')return sendHttp(res,404,{error:'Not found'});void handle(req,res).catch(()=>{if(!res.headersSent)sendHttp(res,500,{error:'MCP request failed'});else res.end();});});
  server.requestTimeout=35_000;server.headersTimeout=10_000;
  return {server,start:()=>new Promise<{url:string}>((resolve,reject)=>{server.once('error',reject);server.listen(options.port??4041,options.host??'127.0.0.1',()=>{server.removeListener('error',reject);const address=server.address();resource=`http://${options.host??'127.0.0.1'}:${typeof address==='object'&&address?address.port:options.port}/mcp`;resolve({url:resource});});}),close:()=>new Promise<void>((resolve,reject)=>{server.closeAllConnections();server.close(err=>err?reject(err):resolve());})};
}
