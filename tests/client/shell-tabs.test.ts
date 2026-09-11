import test from 'node:test';
import assert from 'node:assert/strict';
import {tabCloseControlVisible,tabUrl} from '../../src/client/tab-model.ts';

test('desktop keeps the native close control on a single navigation tab',()=>{
  assert.equal(tabCloseControlVisible(1,true),true);
  assert.equal(tabCloseControlVisible(1,false),false);
  assert.equal(tabCloseControlVisible(2,false),true);
});

test('tab copy control resolves the stored tab route including query and hash',()=>{
  assert.equal(tabUrl('/my-issues?filter=mine#row','https://parabolic.example'),'https://parabolic.example/my-issues?filter=mine#row');
  assert.equal(tabUrl('//hostile.example','https://parabolic.example'),'https://parabolic.example/my-issues');
});
