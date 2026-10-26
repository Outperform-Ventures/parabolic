import {resolve, sep} from 'node:path';
import {realpathSync} from 'node:fs';

// This entry point is only launched against an isolated development snapshot.
const directory = realpathSync(process.env.PARABOLIC_DEV_DATA_DIR || '.local/parabolic-dev');
const database = realpathSync(process.env.PARABOLIC_DATABASE || resolve(directory, 'parabolic.sqlite'));
if (process.env.PARABOLIC_DEV !== '1' || !database.startsWith(directory + sep)) throw Error('Development server requires its isolated workspace.');
delete process.env.PARABOLIC_SMTP_URL;
delete process.env.PARABOLIC_MAIL_FROM;
const disabled = async ():Promise<never> => {throw Error('External integrations are disabled in Parabolic Dev.');};
globalThis.fetch = disabled;
const {createApp} = await import('../src/server/app.ts');
const app = createApp({databasePath:database, host:'127.0.0.1', port:Number(process.env.PORT), backgroundJobs:false,
  publicUrl:process.env.PARABOLIC_PUBLIC_URL, allowedOrigins:[process.env.PARABOLIC_PUBLIC_URL!],
  asksDomainResolver:{txt:disabled,cname:disabled}, logger:(message,error)=>console.error(message,error)});
await app.start();
console.log(`[Parabolic Dev] API ready on 127.0.0.1:${process.env.PORT}; background jobs, email and webhooks disabled.`);
let stopping = false;
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, async () => {
  if (stopping) return; stopping = true;
  await app.close(); process.exit(0);
});
