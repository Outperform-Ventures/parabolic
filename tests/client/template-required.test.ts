import test from 'node:test';
import assert from 'node:assert/strict';
import {missingTemplateFields} from '../../src/client/template-utils';

test('intake required checks distinguish whitespace, numeric zero and required label groups',()=>{
 const template:any={formFields:[{id:'text',label:'Details',type:'text',required:true},{id:'zero',label:'Effort',type:'number',required:true},{id:'kind',label:'Type',type:'property',property:'labelIds',group:'Type',required:true}]};
 const labels:any=[{id:'bug',group:'Type'},{id:'urgent',group:'Priority'},{id:'old',group:'Type',archivedAt:'2026-01-01'}];
 assert.deepEqual(missingTemplateFields(template,{templateAnswers:{text:' \n ',zero:0},labelIds:['urgent']},labels),['Details','Type']);
 assert.deepEqual(missingTemplateFields(template,{templateAnswers:{text:'Ready',zero:0},labelIds:['old','urgent']},labels),['Type']);
 assert.deepEqual(missingTemplateFields(template,{templateAnswers:{text:'Ready',zero:0},labelIds:['bug','urgent']},labels),[]);
});
