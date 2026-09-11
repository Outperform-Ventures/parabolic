import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Browser tests resolve dist/ from cwd. Freeze just the renderer while allowing
// normal work on the repository, and retain all reports outside the snapshot.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const snapshot=await mkdtemp(join(tmpdir(),'parabolic-engine-build-'));
const args=process.argv.slice(2),outputIndex=args.indexOf('--output'),outputArg=args.find(arg=>arg.startsWith('--output='))?.slice(9)??(outputIndex>=0?args[outputIndex+1]:undefined);
const reportDir=outputArg?resolve(root,outputArg):args.some(arg=>arg==='--reporter'||arg.startsWith('--reporter='))?join(root,'artifacts/platform/engine-focused'):join(root,'artifacts/platform');
try{
  await mkdir(join(root,'artifacts/platform'),{recursive:true});
  await mkdir(reportDir,{recursive:true});
  await cp(join(root,'dist'),join(snapshot,'dist'),{recursive:true});
  await symlink(join(root,'artifacts'),join(snapshot,'artifacts'),'dir');
  const html=await readFile(join(snapshot,'dist/index.html'));
  const buildRecord={capturedAt:new Date().toISOString(),indexSha256:createHash('sha256').update(html).digest('hex'),node:process.version,webkitExecutable:process.env.PARABOLIC_WEBKIT_EXECUTABLE??'Playwright default',arguments:args};
  const child=spawn(process.execPath,[join(root,'node_modules/@playwright/test/cli.js'),'test','--config',join(root,'tests/platform/playwright.engines.config.ts'),...args],{cwd:snapshot,env:process.env,stdio:'inherit'});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
  process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code)=>resolve(code??1));});
  await mkdir(reportDir,{recursive:true});
  await writeFile(join(reportDir,'engine-build.json'),JSON.stringify(buildRecord,null,2));
}finally{await rm(snapshot,{recursive:true,force:true});}
