import {test} from 'node:test';import assert from 'node:assert/strict';
import {matchesFilter} from '../src/client/query';
import {withProjectProperties,projectPropertyIndex} from '../src/shared/project-property-filter';
import {issueLinkSources} from '../src/shared/issue-quick-filter';
test('initiative filter follows only visible project membership and supports no initiative',()=>{
 const issue:any={id:'issue',projectId:'project'},projects:any[]=[{id:'project',initiativeIds:['initiative']}];
 const spec:any={match:'all',conditions:[{field:'initiativeIds',operator:'in',value:['initiative']}]};
 assert.equal(matchesFilter(issue,spec,[],projects),true);assert.equal(matchesFilter(issue,spec,[],[]),false);
 assert.deepEqual(withProjectProperties(issue,projectPropertyIndex([])).initiativeIds,[]);
 assert.equal(matchesFilter(issue,{match:'all',conditions:[{field:'initiativeIds',operator:'in',value:[null]}]},[],[]),true);
});
test('link source filtering ignores removed links and matches recorded categories',()=>{
 const issue:any={id:'i',links:[{url:'https://example.test'},{sourceType:'github',url:'https://github.com/a/b'},{sourceType:'slack',deletedAt:'2026-01-01'}]};
 assert.deepEqual(issueLinkSources(issue),['url','github']);
 for(const [source,expected] of [['github',true],['slack',false]] as const)assert.equal(matchesFilter(issue,{match:'all',conditions:[{field:'linkSourceTypes',operator:'in',value:[source]}]}),expected);
});
