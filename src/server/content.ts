import {mediaEmbed} from '../shared/media-embed';
import sanitizeHtml from 'sanitize-html';
import {validHeadingId} from '../shared/heading-links.ts';

const color=[/^#[0-9a-fA-F]{3,8}$/,/^rgba?\([\d\s.,%]+\)$/,/^hsla?\([\d\s.,%]+\)$/,/^[a-zA-Z]+$/];
export function sanitizeEditorContent(value:string){
  return sanitizeHtml(value,{
    allowedTags:['p','br','div','span','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','strike','del','mark','sub','sup','blockquote','ul','ol','li','a','img','pre','code','hr','table','thead','tbody','tfoot','tr','th','td','colgroup','col','details','summary','label','input','iframe'],
    allowedAttributes:{...Object.fromEntries(['h1','h2','h3','h4','h5','h6'].map(tag=>[tag,['data-heading-id','id']])),'*':['class','data-type','data-media-url','data-media-id','data-id','data-label','data-checked','data-date','data-emoji-id','data-emoji-name','data-mention-id','data-mention-kind','data-mention-label','style'],'iframe':['src','title','loading','sandbox','referrerpolicy','allow','allowfullscreen'],'a':['href','title','target','rel'],'img':['src','alt','title','width','height'],'ol':['start'],'li':['value'],'td':['colspan','rowspan','colwidth'],'th':['colspan','rowspan','colwidth'],'input':['type','checked','disabled'],'details':['open'],'code':['data-language'],'pre':['data-language']},
    allowedSchemes:['http','https','mailto','parabolic'],allowedSchemesByTag:{img:['http','https','data','blob']},allowProtocolRelative:false,
    allowedStyles:{'*':{'color':color,'background-color':color,'text-align':[/^(left|right|center|justify)$/],'font-weight':[/^(normal|bold|[1-9]00)$/],'text-decoration':[/^(none|underline|line-through)$/]},'img':{'width':[/^\d+(px|%)$/],'height':[/^\d+(px|%)$/]}},
    transformTags:{'iframe':(_tag,attributes):{tagName:string;attribs:Record<string,string>}=>{const media=mediaEmbed(attributes.src||'');return media?{tagName:'iframe',attribs:{src:media.src,title:media.provider+' video',loading:'lazy',sandbox:'allow-scripts allow-same-origin allow-presentation',referrerpolicy:media.provider==='YouTube'?'strict-origin-when-cross-origin':'no-referrer',allow:'fullscreen; picture-in-picture',allowfullscreen:''}}:{tagName:'span',attribs:{}}},...Object.fromEntries(['h1','h2','h3','h4','h5','h6'].map(tag=>[tag,(tagName:string,attributes:Record<string,string>)=>{const attribs={...attributes};delete attribs.id;if(validHeadingId(attribs['data-heading-id']))attribs.id='heading-'+attribs['data-heading-id'];else delete attribs['data-heading-id'];return {tagName,attribs}}])),'a':(tagName,attribs)=>({tagName,attribs:{...attribs,...(attribs.target==='_blank'?{rel:'noopener noreferrer'}:{})}}),'img':(tagName,attributes)=>{const attribs={...attributes};for(const key of ['width','height'])if(attribs[key]&&(!/^\d{1,5}$/.test(attribs[key])||Number(attribs[key])<1||Number(attribs[key])>10000))delete attribs[key];return {tagName,attribs};},'input':(_tag,attribs)=>({tagName:'input',attribs:{type:'checkbox',disabled:'disabled',...(Object.hasOwn(attribs,'checked')?{checked:'checked'}:{})}})},
    exclusiveFilter:frame=>frame.tag==='img'&&!!frame.attribs.src?.startsWith('data:')&&!/^data:image\/(png|jpeg|gif|webp|avif);base64,/i.test(frame.attribs.src),
  });
}
export function sanitizeEntityContent(entity:Record<string,any>){
  for(const field of ['description','content','body'])if(typeof entity[field]==='string')entity[field]=sanitizeEditorContent(entity[field]);
  if(Array.isArray(entity.history))entity.history=entity.history.map((entry:any)=>({...entry,...(typeof entry.content==='string'?{content:sanitizeEditorContent(entry.content)}:{})}));
  const derived=new Set<string>();const mentions=new Set<string>(Array.isArray(entity.mentionIds)?entity.mentionIds.filter((id:any)=>typeof id==='string'&&!entity.derivedMentionIds?.includes(id)).slice(0,1000):[]);
  const issues=new Set<string>();for(const field of ['description','content','body'])if(typeof entity[field]==='string')for(const match of entity[field].matchAll(/<span\b[^>]*>/gi)){const tag=match[0];const kind=tag.match(/data-mention-kind="([^"]+)"/i)?.[1];const id=tag.match(/data-mention-id="([^"]+)"/i)?.[1];if(kind==='user'&&id&&/^[A-Za-z0-9_-]{1,100}$/.test(id)){mentions.add(id);derived.add(id);}if(kind==='issue'&&id&&/^[A-Za-z0-9_-]{1,100}$/.test(id))issues.add(id);}
  if(mentions.size||entity.mentionIds){entity.mentionIds=[...mentions].slice(0,1000);entity.derivedMentionIds=[...derived].slice(0,1000);}
  if(issues.size||entity.derivedIssueMentionIds)entity.derivedIssueMentionIds=[...issues].slice(0,1000);
  return entity;
}
