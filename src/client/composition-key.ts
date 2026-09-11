/** Composition keys belong to the input method, not app navigation. */
export function isCompositionKey(event:{isComposing?:boolean;key?:string;keyCode?:number}):boolean{return !!event.isComposing||event.keyCode===229||event.key==='Dead'||event.key==='Process';}
