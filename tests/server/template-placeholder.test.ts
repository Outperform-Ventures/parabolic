import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeEditorContent} from '../../src/server/content';
import {structuredDocumentHtml,structuredDocumentJson} from '../../src/server/collaboration-schema';
test('template prompts preserve their formatting through sanitized HTML and the shared collaboration schema',()=>{
 const html='<p>Steps: <span data-type="template-placeholder" class="template-placeholder" onclick="bad()">Describe what happened</span></p>',clean=sanitizeEditorContent(html);
 assert.ok(!clean.includes('onclick'));const doc=structuredDocumentJson(clean);assert.equal(doc.content![0].content![1].marks![0].type,'templatePlaceholder');
 const roundtrip=structuredDocumentHtml(doc);assert.match(roundtrip,/data-type="template-placeholder"/);assert.match(roundtrip,/Describe what happened/);
});

import {finalizeTemplatePlaceholders} from '../../src/server/template-placeholders';
test('saving a templated issue removes untouched prompts, retains filled text and strips prompt-only formatting',()=>{
 const template='<p>Context: <span data-type="template-placeholder">Describe <strong>what happened</strong></span></p><p>Result: <span data-type="template-placeholder">Expected result</span></p>';
 const untouched=finalizeTemplatePlaceholders(template,template);assert.equal(untouched,'<p>Context: </p><p>Result: </p>');
 const filled=finalizeTemplatePlaceholders(template.replace('Describe <strong>what happened</strong>','The <strong>save button failed</strong>'),template);assert.match(filled,/The <strong>save button failed<\/strong>/);assert.ok(!filled.includes('Expected result'));assert.ok(!filled.includes('template-placeholder'));
 assert.match(sanitizeEditorContent(template),/Describe/);assert.match(sanitizeEditorContent(template),/template-placeholder/);
 const plain=finalizeTemplatePlaceholders('<p>Describe what happened</p>',template);assert.equal(plain,'<p>Describe what happened</p>');
});
