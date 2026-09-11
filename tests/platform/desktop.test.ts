import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desktopSessionPartition, NotificationDeduper, routeFromDeepLink, safeExternalUrl, safeRoute, safeServerUrl, trustedRendererUrl, validNotificationTag } from '../../src/desktop/security.js';
import {RendererCommandQueue} from '../../src/desktop/command-queue.ts';
test('Desktop deep links preserve shared routes without allowing external navigation', () => {
  assert.equal(routeFromDeepLink('parabolic://issues/issue-1?focus=comments'), '/issues/issue-1?focus=comments');
  assert.equal(routeFromDeepLink('parabolic:///project/p1/overview'), '/project/p1/overview');
  assert.equal(routeFromDeepLink('parabolic://document/d1?source=share#heading-section-1'), '/document/d1?source=share#heading-section-1');
  for (const url of ['javascript:alert(1)', 'https://evil.example', 'parabolic://user:pass@issues/i1']) assert.equal(routeFromDeepLink(url), null);
  assert.equal(safeRoute('//evil.example'), null); assert.equal(safeRoute('/\\evil.example'), null); assert.equal(safeRoute('/issues/a'), '/issues/a');
});
test('Persisted desktop servers require an HTTPS origin or loopback HTTP',()=>{
  assert.equal(safeServerUrl('https://workspace.example/'),'https://workspace.example');
  assert.equal(safeServerUrl('http://127.0.0.1:4174'),'http://127.0.0.1:4174');
  for(const value of ['https://user:password@workspace.example','http://workspace.example','https://workspace.example/subpath','https://workspace.example?token=x','file:///tmp/app','javascript:alert(1)','https://workspace.example/#fragment'])assert.equal(safeServerUrl(value),null);
  assert.equal(desktopSessionPartition('http://127.0.0.1:4174',true),'persist:parabolic');
  assert.notEqual(desktopSessionPartition('http://127.0.0.1:4174',false),desktopSessionPartition('http://127.0.0.1:4175',false));
  assert.notEqual(desktopSessionPartition('http://127.0.0.1:4174',true),desktopSessionPartition('http://127.0.0.1:4174',false));
  assert.equal(desktopSessionPartition('https://workspace.example/',false),desktopSessionPartition('https://workspace.example/issues',false));
});
test('Desktop external opener accepts only HTTP(S) and email, never executable schemes', () => {
  assert.equal(safeExternalUrl('https://example.com/docs'), 'https://example.com/docs'); assert.equal(safeExternalUrl('mailto:user@example.com'), 'mailto:user@example.com');
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com', 'smb://server/file']) assert.equal(safeExternalUrl(url), null);
  assert.equal(trustedRendererUrl('http://127.0.0.1:4040/issues/a', 'http://127.0.0.1:4040'), true);
  assert.equal(trustedRendererUrl('http://127.0.0.1:4040.evil.example', 'http://127.0.0.1:4040'), false);
});
test('Native notification tags deduplicate across windows with bounded retention and strict input validation',()=>{
 const deduper=new NotificationDeduper(1000,2),tag='workspace:user:notification:2026-09-05T14:00:00.000Z';assert.equal(deduper.accept(tag,0),true);assert.equal(deduper.accept(tag,1),false);assert.equal(deduper.accept(tag,999),false);assert.equal(deduper.accept(tag,1000),true);assert.equal(deduper.accept('another-workspace:user:notification:created',1001),true);assert.equal(deduper.size,2);assert.equal(deduper.accept('third',1002),true);assert.equal(deduper.size,2);assert.equal(deduper.accept(tag,1003),true,'Oldest tags are evicted at the size bound');assert.equal(deduper.accept('fresh',3000),true);assert.equal(deduper.size,1);assert.equal(deduper.accept(undefined,3000),true);assert.equal(deduper.accept(undefined,3000),true);
 for(const invalid of ['',null,42,'a'.repeat(513),'workspace\nnotification','workspace\0notification']){assert.equal(validNotificationTag(invalid),false);assert.throws(()=>deduper.accept(invalid as string,4000),/Invalid notification tag/);}assert.equal(validNotificationTag('a'.repeat(512)),true);assert.equal(validNotificationTag(undefined),true);
});
test('Native startup commands wait for the current renderer listener and stay isolated across windows',()=>{
 const queue=new RendererCommandQueue(2),route={command:'navigate',route:'/issues/startup'};
 assert.deepEqual(queue.enqueue(1,route),[]);assert.deepEqual(queue.ready(2),[]);assert.deepEqual(queue.ready(1),[route]);assert.deepEqual(queue.ready(1),[]);
 assert.deepEqual(queue.enqueue(1,{command:'new-tab'}),[{command:'new-tab'}]);queue.reset(1);assert.deepEqual(queue.enqueue(1,{command:'settings'}),[]);assert.deepEqual(queue.ready(1),[{command:'settings'}]);
 queue.reset(1);for(const command of ['one','two','three'])queue.enqueue(1,{command});assert.deepEqual(queue.ready(1).map(item=>item.command),['two','three']);
 queue.reset(1);queue.enqueue(1,route);queue.remove(1);assert.deepEqual(queue.ready(1),[]);
});
