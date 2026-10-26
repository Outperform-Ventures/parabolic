import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, stat, symlink, link, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {developmentPaths,prepareDevelopmentWorkspace,assertPortAvailable} from '../../scripts/dev-workspace.mjs';
import {createApp} from '../../src/server/app.ts';

async function fixture(run) {
  const root=await mkdtemp(join(tmpdir(),'parabolic-dev-test-'));
  await mkdir(join(root,'production'));
  const source=join(root,'production','parabolic.sqlite'),db=new DatabaseSync(source);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE entities(id TEXT PRIMARY KEY,title TEXT); INSERT INTO entities VALUES('one','Original'); CREATE TABLE sessions(hash TEXT); INSERT INTO sessions VALUES('old-session');");
  const paths=developmentPaths(root,{PARABOLIC_DEV_SOURCE:source});
  try{await run(paths,db,root);}finally{db.close();await rm(root,{recursive:true,force:true});}
}
test('consistent WAL snapshot is private, persistent, independent, and does not copy login sessions',()=>fixture(async(paths,source)=>{
  assert.equal((await prepareDevelopmentWorkspace(paths)).copied,true);
  const copy=new DatabaseSync(paths.database);
  try{
    assert.equal(copy.prepare('SELECT title FROM entities').get().title,'Original');
    assert.equal(copy.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
    assert.equal(source.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
    copy.exec("UPDATE entities SET title='Dev edit'");
    assert.equal(source.prepare('SELECT title FROM entities').get().title,'Original');
    assert.equal((await prepareDevelopmentWorkspace(paths)).copied,false);
    assert.equal(copy.prepare('SELECT title FROM entities').get().title,'Dev edit');
    assert.equal((await stat(paths.database)).mode&0o777,0o600);
    assert.equal((await stat(paths.directory)).mode&0o777,0o700);
  }finally{copy.close();}
}));
test('production directories and database symlink/hardlink aliases are rejected',()=>fixture(async(paths,_source,root)=>{
  await assert.rejects(()=>prepareDevelopmentWorkspace({...paths,directory:join(root,'production')}),/separate/);
  await mkdir(paths.directory,{recursive:true});await symlink(paths.source,paths.database);
  await assert.rejects(()=>prepareDevelopmentWorkspace(paths),/linked production/);
  await rm(paths.database);await link(paths.source,paths.database);
  await assert.rejects(()=>prepareDevelopmentWorkspace(paths),/linked production/);
}));
test('ports must be distinct and occupied ports fail instead of replacing a server',async()=>{
  assert.throws(()=>developmentPaths('/tmp',{PARABOLIC_DEV_PORT:'4274'}),/distinct/);
  assert.throws(()=>developmentPaths('/tmp',{PARABOLIC_DEV_PORT:'0'}),/distinct/);
  const {createServer}=await import('node:net'),server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{await assert.rejects(()=>assertPortAvailable(server.address().port),/No process was stopped/);assert.equal(server.listening,true);}finally{await new Promise(resolve=>server.close(resolve));}
});
test('development API does not start workers or run setup jobs; production default is unchanged',async()=>{
  for(const backgroundJobs of [false,undefined]){
    const app=createApp({databasePath:':memory:',port:0,backgroundJobs}),calls=[];
    for(const key of ['webhooks','scheduler','mail'])app[key].start=()=>calls.push(key);
    app.scheduler.tick=()=>calls.push('tick');
    try{
      const {url}=await app.start();
      const response=await fetch(url+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Dev tester',email:'dev@example.test',password:'fixture-password-only'})});
      assert.equal(response.status,201);
      assert.deepEqual(calls,backgroundJobs===false?[]:['webhooks','scheduler','mail','tick']);
    }finally{await app.close();}
  }
});
