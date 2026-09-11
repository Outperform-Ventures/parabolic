import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {equivalentDescription,formattingOnlyIssueActivity,descriptionVersions,historyDayLabel} from '../../src/client/issue-history-content';
const window=new Window();Object.defineProperty(globalThis,'document',{value:window.document,configurable:true});
test('encoding-only changes are equivalent without erasing meaningful markup, links or text',()=>{
 assert.equal(equivalentDescription('<p>Owner&#39;s note</p>',"<p>Owner's note</p>"),true);
 for(const [before,after] of [['<p>&lt;b&gt;Text&lt;/b&gt;</p>','<p><b>Text</b></p>'],['<p>Text</p>','<p><strong>Text</strong></p>'],['<a href="/a">Text</a>','<a href="/b">Text</a>'],['<p>Text</p>','<p>Changed</p>']])assert.equal(equivalentDescription(before,after),false);
});
test('legacy normalization activity is hidden only when all remaining changes are observed metadata',()=>{
 const event:any={action:'update',changes:{description:{from:'<p>Owner&#39;s note</p>',to:"<p>Owner's note</p>"},startedAt:{from:null,to:'now'},subscribers:{from:[],to:['owner']},subscriberIds:{from:null,to:['owner']}}};
 assert.equal(formattingOnlyIssueActivity(event),true);
 assert.equal(formattingOnlyIssueActivity({...event,message:'A recorded user action'}),false);
 assert.equal(formattingOnlyIssueActivity({...event,changes:{...event.changes,priority:{from:1,to:2}}}),false);
});
test('description versions omit deleted and normalization records while preserving real formatting and original provenance',()=>{
 const issue:any={id:'issue',description:'<p><strong>Current</strong></p>',createdAt:'2026-09-05T21:51:32Z',creatorId:'creator'};
 const events:any[]=[{id:'create',entityId:'issue',action:'create',actorId:'creator'},
 {id:'deleted',entityId:'issue',deletedAt:'now',createdAt:'2026-09-06T00:00:00Z',changes:{description:{from:'Wrong initial',to:'Wrong revision'}}},
 {id:'normalized',entityId:'issue',createdAt:'2026-09-07T00:00:00Z',changes:{description:{from:'<p>Owner&#39;s note</p>',to:"<p>Owner's note</p>"}}},
 {id:'real',entityId:'issue',createdAt:'2026-09-08T00:00:00Z',actorId:'editor',changes:{description:{from:"<p>Owner's note</p>",to:issue.description}}}];
 const versions=descriptionVersions(issue,events);assert.equal(versions.length,2);assert.equal(versions[0].authorId,'editor');assert.equal(versions[0].description,issue.description);assert.equal(versions[1].description,"<p>Owner's note</p>");assert.equal(versions[1].authorId,'creator');
});
test('history day headings distinguish yesterday from today and match native rounded multi-day age',()=>{
 const now=Date.parse('2026-09-08T20:10:00Z');
 assert.equal(historyDayLabel('2026-09-05T21:51:32Z',now),'3 days ago');
 assert.equal(historyDayLabel('2026-09-07T21:17:47Z',now),'Yesterday');
 assert.equal(historyDayLabel('2026-09-08T09:57:54Z',now),'Today');
});
