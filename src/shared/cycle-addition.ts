/** Unknown historical assignment times remain unknown rather than guessed. */
export function cycleAddition(issue:Record<string,any>,cycle?:Record<string,any>|null):'planned'|'duringCycle'|'afterCycle'|null{
 if(!issue.cycleId||!issue.cycleAddedAt||!cycle?.startDate)return null;
 const added=Date.parse(issue.cycleAddedAt),start=Date.parse(cycle.startDate);
 if(!Number.isFinite(added)||!Number.isFinite(start))return null;
 if(added<start+86_400_000)return 'planned';
 const end=Date.parse(cycle.completedAt??cycle.endDate);
 return Number.isFinite(end)?added<end?'duringCycle':'afterCycle':null;
}

export function usesCycleTiming(value:unknown):boolean{if(Array.isArray(value))return value.some(usesCycleTiming);if(!value||typeof value!=='object')return typeof value==='string'&&value.split('.').some(field=>['cycleAddition','cycleAddedAt'].includes(field));return Object.entries(value).some(([key,item])=>key==='cycleAddition'||key==='cycleAddedAt'||usesCycleTiming(item));}

export function cycleAssignmentTime(issue:Record<string,any>,previous:Record<string,any>|undefined,at:string):string|null{return issue.cycleId?(!previous||previous.cycleId!==issue.cycleId?at:previous.cycleAddedAt??null):null;}
