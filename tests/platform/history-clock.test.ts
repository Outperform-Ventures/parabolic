import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reserveHistoryTime,commitHistoryAction,redoIsCurrent,lastHistoryAction} from '../../src/client/history-clock';
test('Tab and mutation history order is monotonic, account scoped, and only successful new actions invalidate redo',()=>{
 const scope='clock-'+crypto.randomUUID(),other='other-'+scope;
 const edit=reserveHistoryTime(scope,100),close=reserveHistoryTime(scope,90);assert.equal(close,edit+1);
 commitHistoryAction(scope,close);commitHistoryAction(scope,edit);assert.equal(lastHistoryAction(scope),close);
 const undoClose=reserveHistoryTime(scope,80),undoEdit=reserveHistoryTime(scope,70);assert.ok(undoEdit>undoClose);assert.equal(redoIsCurrent(scope,undoClose),true);
 reserveHistoryTime(scope,60);assert.equal(redoIsCurrent(scope,undoClose),true,'a failed edit reservation leaves redo intact');
 commitHistoryAction(scope,reserveHistoryTime(scope,50));assert.equal(redoIsCurrent(scope,undoClose),false);assert.equal(redoIsCurrent(scope,undoEdit),false);assert.equal(lastHistoryAction(other),0);
});
