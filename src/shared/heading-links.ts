import {Extension} from '@tiptap/core';
import {Plugin} from '@tiptap/pm/state';

export const validHeadingId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
// Legacy HTML receives the same anchor in the browser and headless schema.
// Once parsed, the attribute follows the heading through edits and collaboration.
function importedHeadingId(element:HTMLElement){
 const stored=element.getAttribute('data-heading-id');if(validHeadingId(stored))return stored;
 const index=Array.from(element.ownerDocument.querySelectorAll('h1,h2,h3,h4,h5,h6')).indexOf(element);
 let hash=2166136261;for(const char of element.textContent||''){hash=Math.imul(hash^char.charCodeAt(0),16777619)}
 return `legacy-${index}-${(hash>>>0).toString(36)}`;
}
export const HeadingLinks=Extension.create<{assignNewIds:boolean}>({
 name:'headingLinks',
 addOptions(){return {assignNewIds:false}},
 addGlobalAttributes(){return [{types:['heading'],attributes:{headingId:{default:null,parseHTML:importedHeadingId,renderHTML:attrs=>validHeadingId(attrs.headingId)?{'data-heading-id':attrs.headingId,id:`heading-${attrs.headingId}`}:{}}}}]},
 addProseMirrorPlugins(){if(!this.options.assignNewIds)return [];return [new Plugin({appendTransaction(transactions,_old,state){
  if(!transactions.some(transaction=>transaction.docChanged))return null;
  const seen=new Set<string>(),tr=state.tr;
  state.doc.descendants((node,pos)=>{if(node.type.name!=='heading')return;let id=node.attrs.headingId;if(!validHeadingId(id)||seen.has(id)){id=crypto.randomUUID();tr.setNodeMarkup(pos,undefined,{...node.attrs,headingId:id})}seen.add(id)});
  return tr.docChanged?tr:null;
 }})]},
});
