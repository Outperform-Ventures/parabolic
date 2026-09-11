import test from'node:test';import assert from'node:assert/strict';import{myIssueActivity}from'../../src/client/my-issues-state';
const status={id:'s',entityKind:'issues',entityId:'i',actorId:'other',createdAt:'2026-01-01',sequence:1,changes:{statusId:{from:'todo',to:'done'}}};
test('personal status activity keeps the assignee at the event time after later reassignment',()=>{
 const move={id:'m',entityKind:'issues',entityId:'i',actorId:'other',createdAt:'2026-01-02',sequence:2,changes:{assigneeId:{from:'me',to:'you'}}};
 assert.equal(myIssueActivity([{id:'i',assigneeId:'you'}] as any,[],[status,move] as any,'me').get('i'),'2026-01-01');
 assert.equal(myIssueActivity([{id:'i',assigneeId:'you'}] as any,[],[status,move] as any,'you').has('i'),false);
 assert.equal(myIssueActivity([{id:'i',assigneeId:'you'}] as any,[],[{...status,assigneeIdAtEvent:'me'}] as any,'me').get('i'),'2026-01-01');
});
test('recorded issue link retains own comment activity after its comment was deleted',()=>{
 assert.equal(myIssueActivity([{id:'i'}] as any,[],[{id:'c',entityKind:'comments',entityId:'deleted-comment',issueId:'i',actorId:'me',createdAt:'2026-01-03'}] as any,'me').get('i'),'2026-01-03');
});
