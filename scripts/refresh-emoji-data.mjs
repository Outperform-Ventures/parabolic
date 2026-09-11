import {readFile,writeFile,mkdir} from 'node:fs/promises';
import imported from '@emoji-mart/data' with {type:'json'};
const source='https://unicode.org/Public/emoji/latest/emoji-test.txt';
const response=await fetch(source);if(!response.ok)throw Error(`Unicode download failed: ${response.status}`);const body=await response.text();
if(!body.includes('# Version: 17.0'))throw Error('Review the new Unicode data version before updating this pinned snapshot.');
await mkdir('reference/unicode',{recursive:true});await writeFile('reference/unicode/emoji-test-17.0.txt',body);
const normalize=value=>value.replaceAll('\ufe0f','');const existing=new Set(Object.values(imported.emojis).flatMap(emoji=>emoji.skins.map(skin=>normalize(skin.native))));
const categories={'Smileys & Emotion':'people','People & Body':'people','Component':'people','Animals & Nature':'nature','Food & Drink':'foods','Travel & Places':'places','Activities':'activity','Objects':'objects','Symbols':'symbols','Flags':'flags'};
let category='people';const emojis={},groups={};let total=0;
for(const line of body.split('\n')){if(line.startsWith('# group: ')){category=categories[line.slice(9)]||'objects';continue}const match=/^([0-9A-F ]+)\s*;\s*(fully-qualified|component)\s*#\s*(\S+)\s+E([\d.]+)\s+(.+)$/.exec(line);if(!match)continue;total++;const native=match[3];if(existing.has(normalize(native)))continue;const id='unicode_'+match[1].trim().toLowerCase().replaceAll(' ','_');emojis[id]={id,name:match[5],keywords:match[5].toLowerCase().split(/[ ,:-]+/),skins:[{native}],version:Number(match[4])};(groups[category]??=[]).push(id);existing.add(normalize(native));}
await writeFile('src/client/features/emoji-supplement.json',JSON.stringify({source,version:'17.0',total,emojis,categories:Object.entries(groups).map(([id,emojis])=>({id,emojis}))}));
const license=await fetch('https://www.unicode.org/license.txt');if(license.ok)await writeFile('reference/unicode/LICENSE.txt',await license.text());
console.log(JSON.stringify({total,added:Object.keys(emojis).length}));
