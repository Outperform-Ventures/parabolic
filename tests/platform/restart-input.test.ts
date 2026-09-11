import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {freezeRestartInput} from '../../src/desktop/restart-input';

test('Restart input freezing includes open dialogs and restores their prior inert states',async()=>{
  const window=new Window(),document=window.document;
  document.body.innerHTML='<dialog open><input value="Unsaved form"></dialog><dialog open inert><input></dialog>';
  const dialogs=document.querySelectorAll('dialog');dialogs[1].inert=true;
  const release=freezeRestartInput(document as unknown as Document);
  assert.equal(document.body.inert,true);for(const dialog of dialogs)assert.equal(dialog.inert,true);
  release();release();assert.equal(document.body.inert,false);assert.equal(dialogs[0].inert,false);assert.equal(dialogs[1].inert,true);
  await window.happyDOM.close();
});

test('Restart input freezing watches dialogs opened later and stops observing after cancellation',async()=>{
  const window=new Window(),document=window.document;
  const dialog=document.createElement('dialog');document.body.append(dialog);
  const release=freezeRestartInput(document as unknown as Document);
  dialog.setAttribute('open','');await new Promise(resolve=>setImmediate(resolve));assert.equal(dialog.inert,true);
  const added=document.createElement('dialog');added.open=true;document.body.append(added);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(added.inert,true);
  release();assert.equal(dialog.inert,false);assert.equal(added.inert,false);
  const after=document.createElement('dialog');after.open=true;document.body.append(after);await new Promise(resolve=>setImmediate(resolve));assert.equal(after.inert,false);
  await window.happyDOM.close();
});
