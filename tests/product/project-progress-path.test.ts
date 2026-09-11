import test from 'node:test';
import assert from 'node:assert/strict';
import {coalesceProjectProgressPoints} from '../../src/client/features/progress-path';

test('dense project activity x clusters retain their final cumulative value without near-vertical segments',()=>{
 const points=[
  {x:25,y:220},
  {x:120,y:190},
  {x:120.00001,y:170},
  {x:120.00002,y:145},
  {x:124,y:130},
  {x:180,y:100},
 ];
 const result=coalesceProjectProgressPoints(points,8);
 assert.deepEqual(result,[{x:25,y:220},{x:124,y:130},{x:180,y:100}]);
 assert.equal(result[1].y,130,'the latest cumulative state in the dense bucket is preserved');
 assert.ok(result.every((point,index)=>index===0||point.x-result[index-1].x>=8));
});

test('project point coalescing preserves ordering and the current endpoint',()=>{
 const current={x:628,y:80},result=coalesceProjectProgressPoints([{x:300.4,y:120},{x:25,y:220},{x:300,y:140},current],8);
 assert.deepEqual(result,[{x:25,y:220},{x:300.4,y:120},current]);
 assert.deepEqual(result.at(-1),current);
});
