import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {lstat,readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';

const require=createRequire(import.meta.url);
const builder=require.resolve('app-builder-lib',{paths:[dirname(require.resolve('electron-builder'))]});
const asar=require(require.resolve('@electron/asar',{paths:[dirname(builder)]}));
const appPath=resolve(process.env.PARABOLIC_INSPECT_APP??'release/mac-arm64/Parabolic.app');
const asarPath=join(appPath,'Contents/Resources/app.asar');
const entries=asar.listPackage(asarPath).map(path=>path.replace(/^\//,''));
const roots=[...new Set(entries.map(path=>path.split('/')[0]))].sort();
assert.deepEqual(roots,['dist','dist-desktop','package.json']);
const excludedDataMatches=entries.filter(path=>/(?:^|\/)(?:reference|audit|tests?|fixtures?|\.git|\.env)(?:\/|$)|(?:^|\/)(?:AGENTS|SKILL)\.md$|\.(?:sqlite|sqlite3|db)(?:-wal|-shm)?$/i.test(path));
assert.deepEqual(excludedDataMatches,[],'Raw private reference, audit, fixture or database files must not ship');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const rendererSha256=sha(asar.extractFile(asarPath,'dist/index.html'));
assert.equal(rendererSha256,sha(await readFile(resolve('dist/index.html'))),'Native package must embed the current verified renderer');
let compiledFilesVerified=0;
for(const path of entries.filter(path=>path.startsWith('dist/')||path.startsWith('dist-desktop/'))){
  const local=resolve(path);if(!(await lstat(local)).isFile())continue;
  assert.equal(sha(asar.extractFile(asarPath,path)),sha(await readFile(local)),`Packaged ${path} must match the frozen compiled file`);compiledFilesVerified++;
}
async function size(path){const info=await lstat(path);if(!info.isDirectory())return info.size;let bytes=0;for(const name of await readdir(path))bytes+=await size(join(path,name));return bytes;}
const asarBytes=await readFile(asarPath);
const result={result:'passed',checkedAt:new Date().toISOString(),appPath,asarPath,rendererSha256,asarSha256:sha(asarBytes),appLogicalBytes:await size(appPath),asarBytes:asarBytes.length,asarEntries:entries.length,compiledFilesVerified,roots,excludedDataMatches};
await mkdir(resolve('artifacts/platform'),{recursive:true});
await writeFile(resolve('artifacts/platform/bundle-inspection.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
