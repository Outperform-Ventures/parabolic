import test from 'node:test';
import assert from 'node:assert/strict';
import {retainedPaletteCommands} from '../../src/client/palette-commands';
import {contextualPaletteItems} from '../../src/client/palette-contexts';
import {createApp} from '../../src/server/app';
import {submitSupport,supportDestination} from '../../src/server/support';
import type {Actor} from '../../src/server/repository';

const labels=['Contact support','Send feedback','Open Parabolic Documentation','Open API Documentation','Parabolic status','Report performance problem'];
test('Batch019 Help commands are unique, ordered, shortcut-free, and hardware is desktop-state gated',()=>{
 const web=retainedPaletteCommands({issue:false}),desktop=retainedPaletteCommands({issue:false,desktop:true,hardwareAccelerationEnabled:true}),disabled=retainedPaletteCommands({issue:false,desktop:true,hardwareAccelerationEnabled:false});
 for(const label of labels){assert.equal(web.filter(row=>row.label===label).length,1,label);assert.equal(web.find(row=>row.label===label)?.shortcut,'',label);}
 assert.ok(!web.some(row=>row.label==='Disable hardware acceleration'));assert.ok(desktop.some(row=>row.label==='Disable hardware acceleration'));assert.ok(!disabled.some(row=>row.label==='Disable hardware acceleration'));
 const projected=contextualPaletteItems([...desktop,{label:'Keyboard shortcuts',icon:'Command',shortcut:'⌘ /',command:{command:'keyboard-shortcuts'}}]);
 assert.deepEqual(projected.filter(row=>row.section==='Help').map(row=>row.label).slice(-7),[...labels,'Open Keyboard Shortcuts Cheat Sheet']);
 assert.deepEqual(projected.filter(row=>row.section==='Developer').map(row=>row.label),['Disable hardware acceleration']);
 for(const label of [...labels,'Disable hardware acceleration'])assert.equal(projected.filter(row=>row.label===label).length,1,label);
});

test('support submission requires explicit configuration and durably transfers only reviewed attachments',async()=>{
 const prior=[process.env.PARABOLIC_SUPPORT_EMAIL,process.env.PARABOLIC_SMTP_URL,process.env.PARABOLIC_MAIL_FROM];delete process.env.PARABOLIC_SUPPORT_EMAIL;delete process.env.PARABOLIC_SMTP_URL;delete process.env.PARABOLIC_MAIL_FROM;
 const unconfigured=createApp({databasePath:':memory:',port:0});
 try{const setup=await unconfigured.auth.setup({name:'Support user',email:'support-user@example.test',password:'support-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']};assert.deepEqual(supportDestination(),{configured:false,email:null});assert.throws(()=>submitSupport(unconfigured.repo,actor,{kind:'support',message:'Help'}),(error:any)=>error.code==='SUPPORT_NOT_CONFIGURED');}
 finally{await unconfigured.close();}
 process.env.PARABOLIC_SUPPORT_EMAIL='internal-support@example.test';process.env.PARABOLIC_SMTP_URL='smtp://127.0.0.1:1';process.env.PARABOLIC_MAIL_FROM='parabolic@example.test';
 const app=createApp({databasePath:':memory:',port:0});
 try{const setup=await app.auth.setup({name:'Feedback user',email:'feedback-user@example.test',password:'feedback-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},id='reviewed-report',content=Buffer.from('{"format":"parabolic-diagnostics-v1"}');app.db.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,actor.workspaceId,actor.userId,'parabolic-diagnostics.json','application/json',content.length,null,null,content,new Date().toISOString());const result=submitSupport(app.repo,actor,{kind:'performance',message:'Scrolling stalls',attachmentIds:[id]});assert.equal(result.queued,true);const mail=app.db.prepare('SELECT to_address,subject,body,dedupe_key FROM mail_outbox WHERE id=?').get(result.mailId) as any;assert.deepEqual([mail.to_address,mail.subject,mail.body],['internal-support@example.test','Performance problem','Scrolling stalls']);assert.match(mail.dedupe_key,/^support:/);const file=app.db.prepare('SELECT filename,mime_type,content FROM mail_outbox_attachments WHERE mail_id=?').get(result.mailId) as any;assert.equal(file.filename,'parabolic-diagnostics.json');assert.equal(file.mime_type,'application/json');assert.deepEqual(Buffer.from(file.content),content);assert.equal(app.db.prepare('SELECT id FROM attachments WHERE id=?').get(id),undefined);}
 finally{await app.close();for(const[key,value]of [['PARABOLIC_SUPPORT_EMAIL',prior[0]],['PARABOLIC_SMTP_URL',prior[1]],['PARABOLIC_MAIL_FROM',prior[2]]] as const)if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
