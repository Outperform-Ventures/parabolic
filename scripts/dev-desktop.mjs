import {spawn} from 'node:child_process';
import {mkdir, writeFile, readFile, unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {context} from 'esbuild';
import {createServer} from 'vite';
import electron from 'electron';
import {developmentPaths, prepareDevelopmentDirectory, prepareDevelopmentWorkspace, assertPortAvailable, waitForHealth} from './dev-workspace.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
process.umask(0o077);
const paths = developmentPaths(root);
const origin = `http://127.0.0.1:${paths.port}`;
const children = new Set(), builds = [];
let vite, stopping = false, desktop, restarting = false, lockOwned = false, input;
const lock = join(paths.directory, 'launcher.lock');
async function stop(code = 0) {
  if (stopping) return; stopping = true; input?.close();
  await Promise.all([...children].map(child => new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve); child.kill('SIGTERM');
  })));
  await vite?.close(); await Promise.all(builds.map(build => build.dispose()));
  if (lockOwned) await unlink(lock).catch(() => {});
  process.exit(code);
}
function child(command, args, env) {
  const process = spawn(command, args, {cwd:root, stdio:'inherit', env});
  children.add(process);
  process.on('error', error => {console.error(error.message); void stop(1);});
  process.on('exit', code => {children.delete(process); if (!stopping && !(process === desktop && restarting)) void stop(code || 0);});
  return process;
}
function launchDesktop() {
  const env = {...process.env, PARABOLIC_DEV:'1', PARABOLIC_RENDERER_URL:origin, PARABOLIC_USER_DATA:paths.profile};
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = child(electron, [paths.build], env);
}
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => void stop());
try {
  await assertPortAvailable(paths.port); await assertPortAvailable(paths.apiPort);
  await prepareDevelopmentDirectory(paths);
  try {await writeFile(lock, String(process.pid), {flag:'wx',mode:0o600}); lockOwned=true;}
  catch {throw Error(`A launcher lock already exists at ${lock}. Check that launcher before removing a stale lock; no process was stopped.`);}
  const snapshot = await prepareDevelopmentWorkspace(paths);
  console.log(`[Parabolic Dev] ${snapshot.copied ? 'Created a safe snapshot of' : 'Reusing'} the development workspace: ${paths.database}`);
  console.log('[Parabolic Dev] This copy is persistent and does not sync edits back to the installed app.');
  await mkdir(paths.build, {recursive:true,mode:0o700});
  const {version} = JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  await writeFile(join(paths.build,'package.json'), JSON.stringify({name:'parabolic-dev',productName:'Parabolic Dev',version,main:'main.cjs'}));
  for (const entry of ['main','preload']) {
    let initial = true;
    const build = await context({entryPoints:[`src/desktop/${entry}.ts`],outfile:join(paths.build,`${entry}.cjs`),bundle:true,platform:'node',format:'cjs',target:'node24',external:['electron'],sourcemap:true,
      plugins:[{name:'desktop-rebuild-notice',setup(build) {build.onEnd(result => {if (!result.errors.length && !initial) console.log('[Parabolic Dev] Native shell rebuilt. Save drafts, then type r + Enter to reopen it.'); initial=false;});}}]});
    builds.push(build); await build.rebuild(); await build.watch();
  }
  const env = {...process.env, PARABOLIC_DEV:'1', PARABOLIC_DEV_DATA_DIR:paths.directory, PARABOLIC_DATABASE:paths.database,
    PORT:String(paths.apiPort), HOST:'127.0.0.1', PARABOLIC_PUBLIC_URL:origin};
  const api = child(process.execPath, ['--watch','--watch-preserve-output','--watch-path=src/server','--watch-path=src/shared','--watch-path=scripts/dev-server.ts','--import','tsx','scripts/dev-server.ts'], env);
  await waitForHealth(`http://127.0.0.1:${paths.apiPort}/api/v1/health`, () => api.exitCode === null && !stopping);
  process.env.PARABOLIC_DEV_API_PORT = String(paths.apiPort);
  vite = await createServer({configFile:join(root,'vite.config.ts'),server:{host:'127.0.0.1',port:paths.port,strictPort:true},define:{'import.meta.env.VITE_PARABOLIC_DEV':JSON.stringify('1')}});
  await vite.listen();
  if (stopping) throw Error('Startup canceled.');
  if (!process.argv.includes('--web-only')) launchDesktop();
  console.log(`[Parabolic Dev] Hot reload ready: ${origin}`);
  console.log('[Parabolic Dev] UI/CSS reload automatically; server code restarts automatically. Quit the Dev app or Ctrl+C to stop.');
  if (process.stdin.isTTY || process.argv.includes('--web-only')) {
    input = createInterface({input:process.stdin,output:process.stdout});
    input.on('line', async line => {
      if (line.trim() === 'q') {void stop();return;}
      if (!desktop) {if(line.trim()==='r') launchDesktop();return;}
      if (line.trim() !== 'r' || restarting || stopping) return;
      restarting=true;
      if (desktop.exitCode === null) await new Promise(resolve => {desktop.once('exit',resolve);desktop.kill('SIGTERM');});
      if (!stopping) launchDesktop(); restarting=false;
    });
  }
} catch (error) {console.error(`[Parabolic Dev] ${error.message}`); await stop(1);}
