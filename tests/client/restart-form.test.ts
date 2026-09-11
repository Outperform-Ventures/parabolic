import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PendingSaves} from '../../src/client/pending-saves';
import {RestartForm} from '../../src/client/restart-form';
test('Restart keeps an edited form open until it is saved or explicitly closed',async()=>{
  const saves=new PendingSaves(),form=new RestartForm(()=> 'New document',saves),detach=form.attach();
  await saves.flush();form.changed();await assert.rejects(saves.flush(),error=>error instanceof AggregateError&&error.errors[0].message.includes('New document'));
  await form.save(async()=>null);await assert.rejects(saves.flush(),AggregateError);
  await form.save(async()=>({id:'saved'}));await saves.flush();
  form.changed();detach();await saves.flush();
});
test('Restart waits for a form submission even when its dialog closes during the request',async()=>{
  const saves=new PendingSaves(),form=new RestartForm(()=> 'New project',saves),detach=form.attach();let finish!:(value:object)=>void,calls=0;
  form.changed();const request=form.save(()=>{calls++;return new Promise<object>(resolve=>{finish=resolve;});});
  assert.equal(form.save(async()=>{calls++;return {};}),request);await Promise.resolve();detach();
  let ready=false;const flushing=saves.flush().then(()=>{ready=true;});await Promise.resolve();assert.equal(ready,false);
  finish({id:'project'});await request;await flushing;assert.equal(calls,1);assert.equal(ready,true);
});
test('A failed form submission remains unsaved and can retry',async()=>{
  const saves=new PendingSaves(),form=new RestartForm(()=> 'Edit details',saves),detach=form.attach();form.changed();
  await assert.rejects(form.save(async()=>{throw Error('Server rejected changes');}),/Server rejected/);
  await assert.rejects(saves.flush(),AggregateError);await form.save(async()=>({id:'saved'}));await saves.flush();detach();
});
test('Edits made during an outstanding form save remain unsaved',async()=>{
  const saves=new PendingSaves(),form=new RestartForm(()=> 'Edit details',saves),detach=form.attach();let finish!:(value:object)=>void;
  form.changed();const request=form.save(()=>new Promise<object>(resolve=>{finish=resolve;}));await Promise.resolve();
  form.changed();finish({id:'saved'});await request;await assert.rejects(saves.flush(),AggregateError);
  await form.save(async()=>({id:'saved-again'}));await saves.flush();detach();
});
