export function parseLabelName(input:string):{name:string;group?:string}|null{
 const text=input.trim();if(!text)return null;
 const split=text.search(/[/:]/);if(split<0)return {name:text};
 const group=text.slice(0,split).trim(),name=text.slice(split+1).trim();
 if(!group||!name||/[/:]/.test(name))return null;
 return {name,group};
}
