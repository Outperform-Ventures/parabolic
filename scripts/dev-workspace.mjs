import {DatabaseSync, backup} from 'node:sqlite';
import {mkdir, chmod, access, realpath, rename, stat} from 'node:fs/promises';
import {dirname, join, resolve, relative, isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {createServer} from 'node:net';

export function developmentPaths(root, env = process.env) {
  const source = resolve(env.PARABOLIC_DEV_SOURCE || join(homedir(), 'Library/Application Support/Parabolic/parabolic.sqlite'));
  const directory = resolve(root, env.PARABOLIC_DEV_DATA_DIR || '.local/parabolic-dev');
  const port = Number(env.PARABOLIC_DEV_PORT || 4273), apiPort = Number(env.PARABOLIC_DEV_API_PORT || 4274);
  if (![port, apiPort].every(p => Number.isInteger(p) && p > 1023 && p < 65536) || port === apiPort) throw Error('Use two distinct development ports between 1024 and 65535.');
  return {source, directory, database:join(directory, 'parabolic.sqlite'), profile:join(directory, 'electron'), build:join(root, '.local/dev-desktop'), port, apiPort};
}

const exists = path => access(path).then(() => true, () => false);
const within = (parent, child) => {const path = relative(parent, child); return !path || (!path.startsWith('..') && !isAbsolute(path));};

export async function prepareDevelopmentDirectory(paths) {
  await mkdir(paths.directory, {recursive:true, mode:0o700});
  const directory = await realpath(paths.directory), sourceDirectory = await realpath(dirname(paths.source));
  if (within(sourceDirectory, directory) || within(directory, sourceDirectory)) throw Error('Development data must be separate from the installed app data.');
  await chmod(directory, 0o700);
  await mkdir(paths.profile, {recursive:true, mode:0o700});
  if (!within(directory, await realpath(paths.profile))) throw Error('Refusing to use a linked production profile.');
  return directory;
}

/** Online SQLite backup includes committed WAL transactions; never copy a live .sqlite file alone. */
export async function prepareDevelopmentWorkspace(paths) {
  const directory = await prepareDevelopmentDirectory(paths);
  if (await exists(paths.database)) {
    const sourceStat = await stat(paths.source), destinationStat = await stat(paths.database);
    if ((sourceStat.dev === destinationStat.dev && sourceStat.ino === destinationStat.ino) || !within(directory, await realpath(paths.database))) throw Error('Refusing to use a linked production database.');
    return {copied:false};
  }
  const source = new DatabaseSync(paths.source, {readOnly:true});
  const temporary = join(directory, `snapshot-${process.pid}-${Date.now()}.sqlite`);
  try {
    await backup(source, temporary);
    await chmod(temporary, 0o600);
    const copy = new DatabaseSync(temporary);
    try {
      if (copy.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw Error('The workspace snapshot failed its integrity check.');
      // Do not reuse production authentication sessions in the development origin.
      if (copy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get()) copy.exec('DELETE FROM sessions');
    } finally {copy.close();}
    await rename(temporary, paths.database);
  } finally {source.close();}
  return {copied:true};
}

export async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(Error(`Port ${port} is in use. No process was stopped. Set PARABOLIC_DEV_PORT and PARABOLIC_DEV_API_PORT to free ports.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

export async function waitForHealth(url, alive = () => true, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline && alive()) {
    try {if ((await fetch(url, {signal:AbortSignal.timeout(1000)})).ok) return;} catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw Error('The development API did not become ready. Check its error output above.');
}
