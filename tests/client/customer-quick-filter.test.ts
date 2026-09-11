import test from 'node:test';import assert from 'node:assert/strict';import{matchCustomerValue}from '../../src/shared/customer-quick-filter';
test('numeric customer filtering uses existential comparisons including not-equal and empty sets',()=>{
 const condition=(operator:string,value=100)=>({field:'customerRevenueValues',operator,value});const entity={customerRevenueValues:[60,50]};
 assert.equal(matchCustomerValue(entity,condition('gte')),false);assert.equal(matchCustomerValue(entity,condition('gte',60)),true);assert.equal(matchCustomerValue(entity,condition('neq',60)),true);assert.equal(matchCustomerValue({customerRevenueValues:[]},condition('neq')),false);assert.equal(matchCustomerValue(entity,condition('eq',50)),true);
});
