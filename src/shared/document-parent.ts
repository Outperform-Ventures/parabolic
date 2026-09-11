export const documentParents={projects:{field:'projectId',label:'Project',route:'/project/'},issues:{field:'issueId',label:'Issue',route:'/issues/'},initiatives:{field:'initiativeId',label:'Initiative',route:'/initiative/'},teams:{field:'teamId',label:'Team',route:'/team/'},cycles:{field:'cycleId',label:'Cycle',route:'/cycles/'}} as const;
export type DocumentParentKind=keyof typeof documentParents;
export type DocumentParent={kind:DocumentParentKind;id:string};
export function resolveDocumentParent(kind:string|null,id:string|null):DocumentParent|undefined{return kind&&id&&Object.hasOwn(documentParents,kind)?{kind:kind as DocumentParentKind,id}:undefined}

export function documentParentPath(parent:DocumentParent):string{return documentParents[parent.kind].route+encodeURIComponent(parent.id)+(parent.kind==='teams'?'/overview':'')}
export function documentMovePatch(parent?:DocumentParent):Record<string,string|null>{const patch:Record<string,string|null>=Object.fromEntries(Object.values(documentParents).map(value=>[value.field,null]));if(parent)patch[documentParents[parent.kind].field]=parent.id;return patch}
