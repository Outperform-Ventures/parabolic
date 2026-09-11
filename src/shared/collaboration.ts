export const collaborationFields = { documents:'content', issues:'description', projects:'description', initiatives:'description', comments:'body' } as const;
export type CollaborationKind = keyof typeof collaborationFields;
export type CollaborationTarget = { [K in CollaborationKind]: {kind:K;id:string;field?:typeof collaborationFields[K]} }[CollaborationKind];
export function resolveCollaborationTarget(kind:string,id:string,field?:string|null):CollaborationTarget|null {
  if(!Object.hasOwn(collaborationFields,kind)||!id||id.length>200)return null;
  const expected=collaborationFields[kind as CollaborationKind];
  return field&&field!==expected?null:{kind:kind as CollaborationKind,id,field:expected} as CollaborationTarget;
}
export function collaborationRoomKey(target:CollaborationTarget):string{return JSON.stringify([target.kind,target.id,collaborationFields[target.kind]]);}

/** Authenticated ownership of immutable Yjs identifiers; null means unknown legacy provenance. */
export interface AuthorshipRange {client:number;clock:number;length:number;userId:string|null}
