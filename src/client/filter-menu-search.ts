/** Contiguous matches include the path; abbreviations match the choice itself. */
export function matchesMenuSearch(name:string,query:string,path=''):boolean {
  const normalize=(text:string)=>text.toLocaleLowerCase().trim();
  const needle=normalize(query),label=normalize(name);
  if(!needle||normalize(path+' '+name).includes(needle))return true;
  const compact=needle.replace(/\s+/g,'');let cursor=0;
  for(const character of label){if(character===compact[cursor])cursor++;if(cursor===compact.length)return true;}
  return false;
}
