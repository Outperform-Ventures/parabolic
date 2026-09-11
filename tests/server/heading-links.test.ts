import {test} from 'node:test';import assert from 'node:assert/strict';import * as Y from 'yjs';
import {documentHtml,importDocumentHtml,normalizedDocumentHtml} from '../../src/server/collaboration-schema.ts';
import {sanitizeEditorContent} from '../../src/server/content.ts';
test('heading anchors are deterministic for legacy HTML and preserved through sanitization, collaboration and rename',()=>{
 const input='<h2>Repeated heading</h2><p>Body</p><h2>Repeated heading</h2>';
 const normalized=normalizedDocumentHtml(input),ids=[...normalized.matchAll(/data-heading-id="([^"]+)"/g)].map(match=>match[1]);assert.equal(ids.length,2);assert.notEqual(ids[0],ids[1]);assert.equal(normalizedDocumentHtml(input),normalized);assert.equal(normalizedDocumentHtml(normalized),normalized);
 const doc=new Y.Doc();try{importDocumentHtml(doc,sanitizeEditorContent(normalized.replaceAll('Repeated heading','Renamed heading')));const output=documentHtml(doc);for(const id of ids)assert.ok(output.includes(`data-heading-id="${id}"`));assert.ok(output.includes('Renamed heading'))}finally{doc.destroy()}
});
test('heading HTML cannot inject arbitrary DOM ids or malformed anchors',()=>{
 assert.equal(sanitizeEditorContent('<h2 id="location" data-heading-id="bad space">Title</h2>'),'<h2>Title</h2>');
 assert.equal(sanitizeEditorContent('<h2 id="location" data-heading-id="safe-anchor">Title</h2>'),'<h2 data-heading-id="safe-anchor" id="heading-safe-anchor">Title</h2>');
});
