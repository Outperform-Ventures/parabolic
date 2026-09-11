import type {Entity} from '../../shared/types';

export function projectArrayValues(project: Entity, field: string): string[] {
  const legacy = field === 'teamIds' ? project.teamId : field === 'initiativeIds' ? project.initiativeId : null;
  return [...new Set<string>([...(Array.isArray(project[field]) ? project[field] : []), ...(legacy ? [legacy] : [])])];
}
export function commonProjectValues(projects: Entity[], field: string): string[] {
  return projects.length ? projectArrayValues(projects[0],field).filter(value => projects.every(project => projectArrayValues(project,field).includes(value))) : [];
}
export function projectBulkChanges(projects: Entity[], patch: Record<string,any>, preserveMixed = false, touched?: string[], labels:Entity[] = []) {
  const groups=new Map(labels.filter(label=>label.group).map(label=>[label.id,label.group]));
  const deltas = new Map(Object.entries(patch).filter(([,value])=>Array.isArray(value)).map(([field,next])=>{
    const common=commonProjectValues(projects,field);
    return [field,{removed:new Set((touched||common).filter(value=>!next.includes(value))),added:next.filter((value:string)=>touched?touched.includes(value):!common.includes(value))}];
  }));
  return projects.map(project => {
    const data = {...patch};
    for (const [field,next] of Object.entries(patch)) if (Array.isArray(next)) {
      if (preserveMixed) {
        const {removed,added} = deltas.get(field)!;
        const replacedGroups=new Set(field==='labelIds'?added.map((id:string)=>groups.get(id)).filter(Boolean):[]);
        data[field] = [...new Set([...projectArrayValues(project,field).filter(value => !removed.has(value)&&!replacedGroups.has(groups.get(value))), ...added])];
      }
      if (field === 'teamIds') data.teamId = data.teamIds.includes(project.teamId) ? project.teamId : data.teamIds[0] || null;
      if (field === 'initiativeIds') data.initiativeId = data.initiativeIds.includes(project.initiativeId) ? project.initiativeId : data.initiativeIds[0] || null;
    }
    return {kind: 'projects' as const, id: project.id, data};
  });
}
