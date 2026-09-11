import {pendingSaves} from './pending-saves';
import React,{useEffect,useRef,useState} from 'react';
import {apiRequest} from './store';
import './template-upload.css';

type Pending={key:string;filename:string;error?:string};
type Value=string|Pending;
type FileInfo={id:string;filename:string;size:number;url:string};
export function TemplateUpload({label,inputId,value,onChange,baseUrl='/api/v1/attachments',uploadUrl=baseUrl}:{label:string;inputId?:string;value?:Value[];onChange:(value:Value[])=>void;baseUrl?:string;uploadUrl?:string}){
 const activeUploads=useRef(0),queue=useRef<{key:string;file:File}[]>([]);
 const values=useRef<Value[]>(value||[]),change=useRef(onChange),mounted=useRef(true),files=useRef(new Map<string,File>()),controllers=useRef(new Map<string,AbortController>());
 values.current=value||[];change.current=onChange;
 const [maxBytes,setMaxBytes]=useState<number|null>(null);
 useEffect(()=>{let active=true;setMaxBytes(null);void apiRequest(baseUrl+'/limits').then(limit=>{if(active&&Number.isSafeInteger(limit.maxBytes)&&limit.maxBytes>0)setMaxBytes(limit.maxBytes)}).catch(()=>{});return()=>{active=false}},[baseUrl]);
 const limitLabel=maxBytes==null?'':(maxBytes>=1024*1024?`${Number((maxBytes/(1024*1024)).toFixed(2))} MiB`:`${maxBytes} bytes`);
 const [metadata,setMetadata]=useState<Record<string,FileInfo>>({}),[errors,setErrors]=useState<Record<string,string>>({}),[dragging,setDragging]=useState(false),[error,setError]=useState('');
 const commit=(next:Value[])=>{values.current=next;change.current(next)};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;queue.current=[];for(const controller of controllers.current.values())controller.abort()}},[]);
 const ids=(value||[]).filter(v=>typeof v==='string').join(',');
 useEffect(()=>{let active=true;for(const id of ids.split(',').filter(Boolean))if(!metadata[id])void apiRequest(baseUrl+'/'+encodeURIComponent(id)+'/metadata').then(info=>{if(active)setMetadata(old=>({...old,[id]:info}))}).catch(()=>{if(active)setErrors(old=>({...old,[id]:'File unavailable'}))});return()=>{active=false}},[ids,baseUrl]);
 const upload=async(key:string,file:File)=>{
  const controller=new AbortController();controllers.current.set(key,controller);
  commit(values.current.map(row=>typeof row!=='string'&&row.key===key?{key,filename:file.name}:row));
  try{await pendingSaves.track(async()=>{const body=new FormData();body.append('file',file);const result:FileInfo=await apiRequest(uploadUrl,{method:'POST',body,signal:controller.signal});if(!mounted.current||controller.signal.aborted)return;setMetadata(old=>({...old,[result.id]:result}));commit(values.current.map(row=>typeof row!=='string'&&row.key===key?result.id:row));files.current.delete(key)})}
  catch(reason){if(!mounted.current||controller.signal.aborted)return;commit(values.current.map(row=>typeof row!=='string'&&row.key===key?{key,filename:file.name,error:reason instanceof Error?reason.message:'Upload failed'}:row))}
  finally{controllers.current.delete(key);activeUploads.current--;pump()}
 };
 const pump=()=>{while(mounted.current&&activeUploads.current<4&&queue.current.length){const next=queue.current.shift()!;if(!values.current.some(row=>typeof row!=='string'&&row.key===next.key))continue;activeUploads.current++;void upload(next.key,next.file)}};
 const schedule=(key:string,file:File)=>{if(controllers.current.has(key)||queue.current.some(item=>item.key===key))return;queue.current.push({key,file});pump()};
 const add=(selected:File[])=>{
  setError('');
  const rows=selected.map(file=>({key:crypto.randomUUID(),filename:file.name,...(maxBytes!==null&&file.size>maxBytes?{error:`File exceeds the server upload limit (${limitLabel})`}:{})}));
  commit([...values.current,...rows]);rows.forEach((row,index)=>{if(row.error)return;files.current.set(row.key,selected[index]);schedule(row.key,selected[index])});
 };
 const remove=(row:Value)=>{if(typeof row!=='string'){controllers.current.get(row.key)?.abort();files.current.delete(row.key)}commit(values.current.filter(item=>typeof row==='string'?item!==row:typeof item==='string'||item.key!==row.key))};
 return <div role="group" tabIndex={0} aria-label={label+' upload area'} className={'template-upload'+(dragging?' dragging':'')} onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();setDragging(true)}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false)}} onDrop={event=>{event.preventDefault();setDragging(false);add([...event.dataTransfer.files])}} onPaste={event=>{if(event.clipboardData.files.length){event.preventDefault();add([...event.clipboardData.files])}}}>
  <label className="template-upload-picker"><span>Choose files or drop them here</span><input id={inputId} type="file" multiple aria-label={label} onChange={event=>{add([...event.target.files||[]]);event.target.value=''}}/>{maxBytes!==null&&<small>Server upload limit: {limitLabel} per file</small>}</label>
  <ul aria-label={label+' files'}>{(value||[]).map(row=>{const id=typeof row==='string'?row:row.key,info=typeof row==='string'?metadata[row]:undefined,name=typeof row==='string'?(info?.filename||errors[row]||'Loading file…'):row.filename,problem=typeof row==='string'?errors[row]:row.error||(!files.current.has(row.key)?'Upload interrupted. Remove this file and choose it again.':undefined);return <li key={id}><div>{info?<a href={info.url} target="_blank" rel="noreferrer">{name}</a>:<span>{name}</span>}{problem?<small role="alert">{problem}</small>:typeof row!=='string'?<small role="status">Uploading…</small>:null}</div>{typeof row!=='string'&&problem&&files.current.has(row.key)&&<button type="button" className="button" onClick={()=>schedule(row.key,files.current.get(row.key)!)}>Retry {name}</button>}<button type="button" className="button" aria-label={'Remove '+name} onClick={()=>remove(row)}>Remove</button></li>})}</ul>{error&&<p role="alert">{error}</p>}
 </div>;
}
