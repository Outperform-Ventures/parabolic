import test from 'node:test';
import assert from 'node:assert/strict';
import { updateAging } from '../../src/shared/update-aging';
test('update staleness uses inclusive daily and weekly public client boundaries',()=>{
 assert.deepEqual(updateAging(7,'weekly',1),{slightlyOutdated:false,outdated:false});
 assert.deepEqual(updateAging(8,'weekly',1),{slightlyOutdated:true,outdated:false});
 assert.equal(updateAging(9,'weekly',1).outdated,false);
 assert.equal(updateAging(10,'weekly',1).outdated,true);
 assert.equal(updateAging(17,'weekly',2).outdated,true);
 assert.deepEqual(updateAging(2,'daily',1),{slightlyOutdated:true,outdated:true});
 assert.equal(updateAging(3,'daily',3).outdated,false);
 assert.equal(updateAging(4,'daily',3).outdated,true);
 assert.equal(updateAging(100,'weekly',0).outdated,false);
});
