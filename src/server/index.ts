import { createApp } from './app.ts';
import { resolve } from 'node:path';
export { createApp } from './app.ts';
const app=createApp({port:Number(process.env.PORT||4174),host:process.env.HOST||'127.0.0.1',databasePath:process.env.PARABOLIC_DATABASE,staticDir:resolve(process.env.PARABOLIC_STATIC_DIR||'dist'),allowedOrigins:(process.env.PARABOLIC_ALLOWED_ORIGINS||'http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:5173,http://localhost:5173').split(','),publicUrl:process.env.PARABOLIC_PUBLIC_URL,webhookAllowPrivateHosts:process.env.PARABOLIC_ALLOW_PRIVATE_WEBHOOKS==='true',logger:(message,error)=>console.error(message,error)});
app.start().then(({url})=>console.log(`Parabolic server listening at ${url}`)).catch(error=>{console.error(error);process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void app.close().then(()=>process.exit(0)));
