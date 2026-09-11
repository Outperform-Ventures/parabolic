import {Node} from '@tiptap/core';
export type CustomEmojiValue={id:string;name:string;url:string;deletedAt?:string|null};
export const customEmojiUrl=(value:unknown):string|null=>typeof value==='string'&&/^\/api\/v1\/attachments\/[A-Za-z0-9_-]{1,100}$/.test(value)?value:null;
export const customEmojiName=(value:unknown)=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)?value:'emoji';
export function emojiNodeAttributes(value:CustomEmojiValue){return {id:value.id,name:customEmojiName(value.name),src:customEmojiUrl(value.url)};}
/** Shared schema keeps custom emoji inline through HTML, clipboard, and CRDT projections. */
export const CustomEmoji=Node.create({
 name:'customEmoji',group:'inline',inline:true,atom:true,selectable:false,draggable:false,priority:1100,
 addAttributes(){return {id:{default:'',parseHTML:element=>element.getAttribute('data-emoji-id')},name:{default:'emoji',parseHTML:element=>customEmojiName(element.getAttribute('data-emoji-name'))},src:{default:null,parseHTML:element=>customEmojiUrl(element.getAttribute('src'))}}},
 parseHTML(){return [{tag:'img[data-type="custom-emoji"]',priority:1100}]},
 renderHTML({node}){const name=customEmojiName(node.attrs.name),src=customEmojiUrl(node.attrs.src);if(!src)return ['span',{'data-type':'custom-emoji','data-emoji-id':String(node.attrs.id),'data-emoji-name':name},`:${name}:`];return ['img',{'data-type':'custom-emoji','data-emoji-id':String(node.attrs.id),'data-emoji-name':name,src,alt:`:${name}:`,title:`:${name}:`,class:'editor-custom-emoji',width:18,height:18,draggable:'false'}];},
 renderText({node}){return `:${customEmojiName(node.attrs.name)}:`},
});
