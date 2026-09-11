import {isAbsolute} from 'node:path';
export type EmbeddedServiceOptions={databasePath:string;staticDir:string;port:number};
export type ServiceReady={type:'ready';url:string;port:number;pid:number};
export function validServiceOptions(value:unknown):value is EmbeddedServiceOptions{
 const data=value as EmbeddedServiceOptions;
 return !!data&&typeof data.databasePath==='string'&&isAbsolute(data.databasePath)&&typeof data.staticDir==='string'&&isAbsolute(data.staticDir)&&Number.isInteger(data.port)&&(data.port===0||data.port>1023&&data.port<65536);
}
export function validServiceReady(value:unknown,requestedPort:number,pid:number|undefined):value is ServiceReady{
 const data=value as ServiceReady;
 return !!data&&data.type==='ready'&&Number.isInteger(data.port)&&data.port>1023&&data.port<65536&&(!requestedPort||data.port===requestedPort)&&data.url===`http://127.0.0.1:${data.port}`&&Number.isInteger(data.pid)&&data.pid===pid;
}
