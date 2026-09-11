import test from 'node:test';
import assert from 'node:assert/strict';
import {editableContextMenu} from '../../src/desktop/editor-context-menu';

test('editable text context menu exposes the observed native actions and current availability',()=>{
  const menu=editableContextMenu({isEditable:true,editFlags:{canCopy:true,canDelete:false,canSelectAll:true}});
  assert.deepEqual(menu.map(item=>({label:item.label,role:item.role,enabled:item.enabled})),[
    {label:'Copy',role:'copy',enabled:true},
    {label:'Select',role:'selectAll',enabled:true},
    {label:'Delete',role:'delete',enabled:false},
  ]);
});

test('non-editable surfaces retain their existing context behavior',()=>{
  assert.deepEqual(editableContextMenu({isEditable:false,editFlags:{canCopy:true,canDelete:true,canSelectAll:true}}),[]);
});
