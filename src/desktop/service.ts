import {createApp} from '../server/app';
import {validServiceOptions,type EmbeddedServiceOptions} from './service-protocol';
const parent=process.parentPort;
if(!parent)throw new Error('The embedded service must run in an Electron utility process.');
let service:ReturnType<typeof createApp>|undefined,starting:Promise<void>|undefined,stopping=false,stopPromise:Promise<void>|undefined;
const send=(message:unknown)=>{try{parent.postMessage(message);}catch{}};
function stop(code=0){return stopPromise??=(async()=>{
 stopping=true;const limit=setTimeout(()=>process.exit(code||1),7000);limit.unref();
 try{await starting?.catch(()=>{});await service?.close();send({type:'stopped'});}catch(error){send({type:'error',message:error instanceof Error?error.message:String(error)});code=1;}
 finally{clearTimeout(limit);process.exit(code);}
})();}
function start(config:EmbeddedServiceOptions){
 if(starting||stopping){send({type:'error',message:'The workspace service has already been started.'});return;}
 starting=(async()=>{service=createApp({...config,host:'127.0.0.1'});const result=await service.start();if(!stopping)send({type:'ready',url:result.url,port:result.port,pid:process.pid});})();
 void starting.catch(error=>{send({type:'error',message:error instanceof Error?error.message:String(error)});void stop(1);});
}
parent.on('message',event=>{
 const message=event.data;
 if(message?.type==='shutdown'){void stop();return;}
 if(message?.type==='start'){if(validServiceOptions(message.config))start(message.config);else{send({type:'error',message:'Invalid embedded workspace service configuration.'});void stop(1);}}
});
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
process.on('uncaughtException',error=>{send({type:'error',message:error.message});void stop(1);});
process.on('unhandledRejection',error=>{send({type:'error',message:error instanceof Error?error.message:String(error)});void stop(1);});
