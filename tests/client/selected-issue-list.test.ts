import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedIssueListUrl,resolveSelectedIssues,selectedIssueTokens} from '../../src/client/selected-issue-list';
test('one-off issue links preserve exact membership, aliases and UUID fallback',()=>{
 const first:any={id:'8f5c3f03-95da-42f6-9234-51f88eb7766e',identifier:'ENG-7',previousIdentifiers:['OLD-2']},second:any={id:'second',identifier:'ENG-8'},deleted:any={id:'gone',identifier:'ENG-9',deletedAt:'2026-01-01'};
 assert.equal(selectedIssueListUrl('https://internal.example/',[first,second,first]),'https://internal.example/issues/ENG-7,ENG-8');
 assert.deepEqual(resolveSelectedIssues('OLD-2,eng-8,ENG-9,PRIVATE-8',[first,second,deleted]),[first.id,second.id]);
 assert.deepEqual(resolveSelectedIssues('PRIVATE-8',[first,second]),[]);
 assert.deepEqual(selectedIssueTokens(first.id+','+first.id),[first.id]);
});
