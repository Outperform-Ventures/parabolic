import {utilityProcess} from 'electron';
import {join} from 'node:path';
import {superviseService,type EmbeddedService} from './service-lifecycle';
import type {EmbeddedServiceOptions} from './service-protocol';
export type {EmbeddedService};
export function startEmbeddedService(config:EmbeddedServiceOptions,onUnexpectedExit:(error:Error)=>void){
 const child=utilityProcess.fork(join(__dirname,'service.cjs'),[],{serviceName:'Parabolic Workspace Service',stdio:'pipe'});
 return superviseService(child,config,{onUnexpectedExit,log:text=>process.stderr.write(text)});
}
