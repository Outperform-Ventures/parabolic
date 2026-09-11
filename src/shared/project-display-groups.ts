import type {Entity} from './types';
export const labelGroupColumn=(name:string,groups:Entity[]=[])=>{const group=groups.find(g=>!g.deletedAt&&g.entityType==='projects'&&g.name===name);return group?'labelGroupId:'+group.id:'labelGroup:'+encodeURIComponent(name)};
export function columnLabelGroup(field:string,groups:Entity[]=[]):string|null{
 if(field.startsWith('labelGroupId:'))return groups.find(g=>!g.deletedAt&&g.id===field.slice(13))?.name??null;
 if(!field.startsWith('labelGroup:'))return null;try{return decodeURIComponent(field.slice(11))}catch{return null}
}
export function migrateProjectDisplayGroups<T extends {group?:string;sort?:string;columns?:string[]}>(display:T,groups:Entity[]):T{
 const convert=(field:string,fallback:string)=>{
  if(field.startsWith('labelGroupId:'))return groups.some(g=>g.id===field.slice(13)&&g.deletedAt)?fallback:field;
  const name=columnLabelGroup(field);if(name===null)return field;
  const group=groups.find(g=>!g.deletedAt&&g.entityType==='projects'&&g.name===name)??groups.find(g=>!g.deletedAt&&g.entityType==='projects'&&g.previousNames?.includes(name));
  return group?'labelGroupId:'+group.id:field;
 };
 const next={...display,...(display.group?{group:convert(display.group,'none')}:{}),...(display.sort?{sort:convert(display.sort,'name')}:{}),...(display.columns?{columns:[...new Set(display.columns.map(field=>convert(field,'')).filter(Boolean))]}:{})};
 return JSON.stringify(next)===JSON.stringify(display)?display:next;
}
