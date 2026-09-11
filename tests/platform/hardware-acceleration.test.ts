import {afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadDesktopDevicePreferences,requestDisableHardwareAcceleration,saveDesktopDevicePreferences} from '../../src/desktop/hardware-acceleration.ts';

const directories:string[]=[];
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const directory=()=>{const value=mkdtempSync(join(tmpdir(),'parabolic-hardware-test-'));directories.push(value);return value;};

test('desktop acceleration preference is strict, atomic and private',()=>{
  const root=directory();
  assert.deepEqual(loadDesktopDevicePreferences(root),{hardwareAccelerationDisabled:false});
  writeFileSync(join(root,'desktop-preferences.json'),JSON.stringify({hardwareAccelerationDisabled:'yes',extra:true}));
  assert.deepEqual(loadDesktopDevicePreferences(root),{hardwareAccelerationDisabled:false});
  saveDesktopDevicePreferences(root,{hardwareAccelerationDisabled:true});
  assert.deepEqual(JSON.parse(readFileSync(join(root,'desktop-preferences.json'),'utf8')),{hardwareAccelerationDisabled:true});
  assert.equal(statSync(join(root,'desktop-preferences.json')).mode&0o777,0o600);
});

test('disable request cancels without writes and persists only after restart preparation',async()=>{
  const calls:string[]=[];
  const dependencies={disabled:()=>false,confirm:async()=>false,prepareRestart:async()=>{calls.push('prepare');return{assertReady:()=>{calls.push('assert');},cancel:()=>{calls.push('cancel');}}},beforeRelaunch:()=>{calls.push('flush');},persist:()=>{calls.push('persist');},relaunch:()=>{calls.push('relaunch');}};
  assert.deepEqual(await requestDisableHardwareAcceleration(dependencies),{accepted:false,reason:'cancelled'});assert.deepEqual(calls,[]);
  dependencies.confirm=async()=>true;
  assert.deepEqual(await requestDisableHardwareAcceleration(dependencies),{accepted:true,reason:'relaunching'});
  assert.deepEqual(calls,['prepare','assert','flush','assert','persist','assert','relaunch']);
});

test('disable request cancels a prepared lease when flush or persistence fails',async()=>{
  const calls:string[]=[];
  await assert.rejects(requestDisableHardwareAcceleration({disabled:()=>false,confirm:async()=>true,prepareRestart:async()=>({assertReady:()=>{calls.push('assert');},cancel:()=>{calls.push('cancel');}}),beforeRelaunch:()=>{throw Error('disk unavailable')},persist:()=>{calls.push('persist');},relaunch:()=>{calls.push('relaunch');}}),/disk unavailable/);
  assert.deepEqual(calls,['assert','cancel']);
  assert.deepEqual(await requestDisableHardwareAcceleration({disabled:()=>true,confirm:async()=>{throw Error('must not confirm')},prepareRestart:async()=>{throw Error('must not prepare')},beforeRelaunch:()=>{},persist:()=>{},relaunch:()=>{}}),{accepted:false,reason:'already-disabled'});
});
