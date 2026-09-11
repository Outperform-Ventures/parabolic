/** Empty-query inventory captured on native My issues Assigned; other retained
 * commands remain searchable rather than being inferred absent from one capture. */
export const paletteDefaultInventory = [
 ['Issues','Create new issue','Create new issue…','C'],
 ['Issues','Create issue in fullscreen','Create issue in fullscreen…','V'],
 ['Issues','Create new label','Create new label…',''],
 ['Projects','Create new project','Create new project…','N P'],
 ['Documents','Create new document','Create new document in…',''],
 ['Views','Create view','Create view…',''],
 ['Initiatives','Create new initiative','Create new initiative','N I'],
 ['Customers','Add customer request','Add customer request…','⌃ R'],
 ['Customers','Create new customer','Create new customer…',''],
 ['Filter','Search workspace','Search workspace…',''],
 ['Filter','Find in view','Find in view…','⌘ F'],
 ['Filter','Add filter','Add Filter…','F'],
 ['Templates','Create new issue template','Create new issue template…',''],
] as const;
export function defaultPaletteItems<T extends {label:string;shortcut?:string}>(commands:T[]){
 return paletteDefaultInventory.flatMap(([section,source,label,shortcut])=>{const command=commands.find(row=>row.label===source);return command?[{...command,label,shortcut,section}]:[];});
}
