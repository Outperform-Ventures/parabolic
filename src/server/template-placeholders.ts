import sanitizeHtml from 'sanitize-html';
import {sanitizeEditorContent} from './content';

/** Keep template prompts while editing; discard untouched prompts at issue creation. */
export function finalizeTemplatePlaceholders(description:string,templateDescription:string){
 const prompts=new Set<string>();
 const isPrompt=(frame:sanitizeHtml.IFrame)=>frame.tag==='span'&&frame.attribs['data-type']==='template-placeholder';
 sanitizeHtml(templateDescription,{allowedTags:false,allowedAttributes:false,exclusiveFilter:frame=>{if(isPrompt(frame))prompts.add(frame.text);return false;}});
 const completed=sanitizeHtml(description,{allowedTags:false,allowedAttributes:false,exclusiveFilter:frame=>isPrompt(frame)?prompts.has(frame.text)?true:'excludeTag':false});
 return sanitizeEditorContent(completed);
}
