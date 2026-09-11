import {Mark} from '@tiptap/core';

// Shared by every editor and the server schema so applying a template does not
// strip its prompts during persistence or collaborative editing.
export const TemplatePlaceholder=Mark.create({
 name:'templatePlaceholder',inclusive:false,
 parseHTML(){return [{tag:'span[data-type="template-placeholder"]'}]},
 renderHTML(){return ['span',{'data-type':'template-placeholder',class:'template-placeholder'},0]},
});
