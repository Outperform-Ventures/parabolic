import type {Entity} from './types';
export function estimateLabel(value:number,team?:Record<string,any>):string{
 if(String(team?.estimateScale).toLowerCase()==='t-shirt'){
  const index=[1,2,3,5,8,13,21].indexOf(value);
  if(index>=0)return ['XS','S','M','L','XL','XXL','XXXL'][index];
 }
 return String(value);
}
export function estimateOptions(config: Record<string, any> = {}, existingValues: unknown[] = []) {
 const existing = [...new Set(existingValues.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0))];
 const exponential = [1, 2, 4, 8, 16, 32, 64];
 // Older imports retained points but omitted team scale settings. Infer only an
 // unconfigured, unambiguous exponential scale; never rewrite team settings.
 const inferredExponential = !config.estimateScale && existing.some(value => [4, 16, 32, 64].includes(value)) && existing.every(value => value === 0 || exponential.includes(value));
 const scale = config.estimateScale ?? (inferredExponential ? 'Exponential' : 'Fibonacci');
 const points = scale === 'Exponential' ? exponential : scale === 'Parabolic' ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 5, 8, 13, 21];
 const options = [{ id: null as number | null, name: 'No estimate' }, ...(scale !== 'None' && config.zeroEstimate !== false ? [{ id: 0, name: '0' }] : []), ...(scale === 'None' ? [] : points.slice(0, (config.extendedEstimates ?? inferredExponential) ? 7 : 5)).map((id, index) => ({ id, name: scale.toLowerCase() === 't-shirt' ? ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'][index] : String(id) }))];
 // Keep historical/custom values selectable and checked, even after a scale change.
 if (scale !== 'None') for (const id of existing) if (!options.some(option => option.id === id)) options.push({ id, name: estimateLabel(id, config) });
 return options.sort((a, b) => a.id === null ? -1 : b.id === null ? 1 : a.id - b.id);
}
export function issueEffort(issue:Record<string,any>,team?:Record<string,any>,unit:'points'|'issues'='points'){if(unit==='issues'||team?.estimateScale==='None')return 1;return typeof issue.estimate==='number'&&Number.isFinite(issue.estimate)?issue.estimate:typeof team?.defaultIssueEstimate==='number'&&Number.isFinite(team.defaultIssueEstimate)?team.defaultIssueEstimate:team?.unestimatedAsOne===false?0:1;}
