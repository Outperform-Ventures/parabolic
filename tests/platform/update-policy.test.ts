import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {updateDisabledReason} from '../../src/desktop/update-policy';
const require=createRequire(import.meta.url),feed=require('../../scripts/desktop-update-feed.cjs');
test('Desktop updates respect managed disablement and require a configured packaged Mac build',()=>{
  const valid={platform:'darwin',packaged:true,managedDisabled:false,configured:true};
  assert.equal(updateDisabledReason(valid),undefined);
  assert.match(updateDisabledReason({...valid,managedDisabled:true})!,/administrator/);
  assert.match(updateDisabledReason({...valid,packaged:false})!,/development/);
  assert.match(updateDisabledReason({...valid,configured:false})!,/no update service/);
  assert.match(updateDisabledReason({...valid,platform:'linux'})!,/platform/);
});
test('Desktop update feed configuration requires HTTPS and never embeds credentials or URL tokens',()=>{
  assert.equal(feed(undefined),undefined);assert.equal(feed(''),undefined);
  assert.deepEqual(feed('https://updates.example.test/parabolic'),{provider:'generic',url:'https://updates.example.test/parabolic/'});
  for(const url of ['http://updates.example.test','https://user:secret@updates.example.test','https://updates.example.test?token=secret','https://updates.example.test/#hash','file:///tmp/updates','not a url'])assert.throws(()=>feed(url));
});
