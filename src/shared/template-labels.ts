// Preserve configured references, but never apply archived labels or groups.
// Unknown IDs still reach normal validation.
export function templateLabelDefaults<T extends Record<string,any>>(fields:T,lookup:(id:string)=>Record<string,any>|null|undefined):T{
  return Array.isArray(fields.labelIds)?{...fields,labelIds:fields.labelIds.filter((id:string)=>{const label=lookup(id);return !label?.archivedAt&&!(label?.deletedAt&&label.convertedTo==='labelGroups')})}:fields;
}
