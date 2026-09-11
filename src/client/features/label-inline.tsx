import React,{useEffect,useRef,useState} from 'react';
import {Dropdown} from '../components/ui';
import {ColorSpectrum} from './color-spectrum';
import {useActions,type Row} from './shared';
import './label-settings.css';

export function LabelInline({label}:{label:Row}){
 const {update,act}=useActions();const [editing,setEditing]=useState(false),[name,setName]=useState(label.name),[busy,setBusy]=useState(false),[preview,setPreview]=useState(label.color||'#7775df');const canceled=useRef(false),saving=useRef(false);
 useEffect(()=>setPreview(label.color||'#7775df'),[label.color]);
 const save=async()=>{if(canceled.current||saving.current)return;const next=name.trim();if(!next){setName(label.name);setEditing(false);return}if(next===label.name){setEditing(false);return}saving.current=true;setBusy(true);const result=await act(()=>update('labels',label.id,{name:next}));saving.current=false;setBusy(false);if(result!==null)setEditing(false)};
 const color=async(value:string)=>{setPreview(value);await act(()=>update('labels',label.id,{color:value}))};
 return <div className="label-inline-properties">
  <Dropdown trigger={<button type="button" className="label-color-button" aria-label={'Change color for '+label.name} onClick={()=>setPreview(label.color||'#7775df')}><span style={{background:label.color||'#7775df'}}/></button>}>
   <div className="label-color-editor"><ColorSpectrum color={preview} onPreview={setPreview} onChange={value=>void color(value)}/><label>Hex color<input aria-label="Label hex color" className="input" value={preview} onChange={event=>setPreview(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&/^#[0-9a-f]{6}$/i.test(preview)){event.preventDefault();void color(preview)}}} onBlur={()=>{if(/^#[0-9a-f]{6}$/i.test(preview)&&preview!==label.color)void color(preview)}}/></label></div>
  </Dropdown>
  <div>{editing?<input className="input label-inline-name" aria-label="Label name" value={name} readOnly={busy} aria-busy={busy} autoFocus onFocus={event=>event.target.select()} onChange={event=>setName(event.target.value)} onBlur={()=>void save()} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();canceled.current=true;setEditing(false)}else if(event.key==='Enter'){event.preventDefault();void save()}}}/>:<button type="button" className="label-name-button" title={label.description} onClick={()=>{canceled.current=false;setName(label.name);setEditing(true)}}>{label.name}</button>}{label.description&&<p>{label.description}</p>}</div>
 </div>;
}
