import React from 'react';
export function paletteShortcutParts(shortcut:string){return shortcut.trim()?shortcut.trim().split(/\s+/).flatMap((key,index)=>index&&/^[NOGP] /.test(shortcut)?[{key:'then',separator:true},{key,separator:false}]:[{key:key==='⌃'?'Ctrl':key,separator:false}]):[];}
export function PaletteKeycaps({shortcut=''}:{shortcut?:string}){return <span className="palette-keycaps" aria-label={shortcut||undefined}>{paletteShortcutParts(shortcut).map((part,i)=>part.separator?<span key={i} className="palette-key-separator">then</span>:<kbd key={i}>{part.key}</kbd>)}</span>;}
