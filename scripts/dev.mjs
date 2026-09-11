import { spawn } from 'node:child_process';
const processes = [spawn(process.execPath,['--import','tsx','src/server/index.ts'],{stdio:'inherit',env:{...process.env,PARABOLIC_PUBLIC_URL:process.env.PARABOLIC_PUBLIC_URL||'http://127.0.0.1:4173'}}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'inherit',env:process.env})];
let stopping=false;function stop(code=0){if(stopping)return;stopping=true;for(const child of processes)child.kill('SIGTERM');setTimeout(()=>process.exit(code),300).unref();}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());for(const child of processes)child.on('exit',code=>stop(code??0));
