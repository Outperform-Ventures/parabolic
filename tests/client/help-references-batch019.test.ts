import test from 'node:test';
import assert from 'node:assert/strict';
import {apiReferenceSections,parabolicDocumentationArticles,HELP_REFERENCE_EVENT,loadParabolicHealth} from '../../src/client/help-reference-data';

test('bundled product and API references are distinct, complete, and Parabolic-only',()=>{
 assert.ok(parabolicDocumentationArticles.length>=6);
 assert.deepEqual(apiReferenceSections.map(section=>section.title),['Service origin','Authentication','REST API','GraphQL','Parabolic SDK','Webhooks','MCP']);
 const text=JSON.stringify([parabolicDocumentationArticles,apiReferenceSections]);
 assert.doesNotMatch(text,/parabolic\.app|Open Parabolic Documentation/i);
 assert.match(text,/@parabolic\/sdk/);
 assert.equal(HELP_REFERENCE_EVENT,'parabolic:help-reference');
});

test('health check reports a fresh successful same-origin response',async()=>{
 let request:any;
 const fetcher=(async(input:any,init:any)=>{request={input,init};return new Response(JSON.stringify({status:'ok',version:'9.4.1'}),{status:200,headers:{'content-type':'application/json'}})}) as typeof fetch;
 assert.deepEqual(await loadParabolicHealth(fetcher),{status:'operational',version:'9.4.1'});
 assert.equal(request.input,'/api/v1/health');
 assert.equal(request.init.cache,'no-store');
 assert.equal(request.init.credentials,'same-origin');
});

test('health check never calls a failed or malformed response operational',async()=>{
 const unavailable=(async()=>new Response('down',{status:503})) as typeof fetch;
 assert.deepEqual(await loadParabolicHealth(unavailable),{status:'unavailable',message:'Service returned HTTP 503'});
 const malformed=(async()=>new Response(JSON.stringify({status:'degraded',version:'1'}),{status:200})) as typeof fetch;
 assert.deepEqual(await loadParabolicHealth(malformed),{status:'unavailable',message:'Service reported an unavailable state'});
 const timeout=(async(_input:any,init:any)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))) as typeof fetch;
 assert.deepEqual(await loadParabolicHealth(timeout,5),{status:'unavailable',message:'Status request timed out'});
});
