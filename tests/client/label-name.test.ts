import test from 'node:test';import assert from 'node:assert/strict';import {parseLabelName} from '../../src/client/label-name';
test('label picker names support one-level slash and colon groups and reject incomplete paths',()=>{
 assert.deepEqual(parseLabelName('  Bug  '),{name:'Bug'});assert.deepEqual(parseLabelName(' Type / Bug '),{name:'Bug',group:'Type'});assert.deepEqual(parseLabelName('Type:Bug'),{name:'Bug',group:'Type'});
 for(const value of ['',' ','/Bug','Type/','Type/Bug/Urgent','Type:Bug:Urgent'])assert.equal(parseLabelName(value),null);
});
