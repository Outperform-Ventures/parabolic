import type {Entity} from '../../shared/types';

export type ScheduleOptions = {
  calendarMode?: 'month' | 'week';
  calendarDateField?: 'startDate' | 'dueDate' | 'targetDate';
  scheduleAnchor?: string;
  timelineScale?: 'week' | 'month' | 'quarter';
  showDependencies?: boolean;
  showUnscheduled?: boolean;
};
export const dayMs = 86400000;
// Date-only arithmetic deliberately uses UTC: DST must never stretch a task.
export function dateDay(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const text = value.slice(0, 10), ms = Date.parse(text + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === text ? ms / dayMs : null;
}
export const dayDate = (day: number) => new Date(day * dayMs).toISOString().slice(0,10);
export const todayDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const weekStart = (day: number) => day - (new Date(day * dayMs).getUTCDay() + 6) % 7;
export function calendarDays(anchor: string, mode: 'month' | 'week') {
  const day = dateDay(anchor) ?? dateDay(todayDate())!;
  if (mode === 'week') return Array.from({length:7}, (_,i)=>weekStart(day)+i);
  const d = new Date(day * dayMs), first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / dayMs;
  return Array.from({length:42}, (_,i)=>weekStart(first)+i);
}
export function shiftPeriod(anchor: string, direction: number, mode: 'month' | 'week' | 'quarter') {
  const day = dateDay(anchor) ?? dateDay(todayDate())!;
  if (mode === 'week') return dayDate(day + direction * 7);
  const d = new Date(day * dayMs);
  return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+direction*(mode==='quarter'?3:1),1)).toISOString().slice(0,10);
}
export function scheduleRange(item: Entity, endField: string) {
  const rawStart = dateDay(item.startDate), rawEnd = dateDay(item[endField]);
  if (rawStart === null && rawEnd === null) return null;
  const start = rawStart ?? rawEnd!, end = rawEnd ?? rawStart!;
  return { start: Math.min(start,end), end: Math.max(start,end) };
}
export function moveSchedule(item: Entity, endField: string, days: number): Record<string,string> {
  const range = scheduleRange(item,endField);
  if (!range) return {};
  return { startDate: dayDate(range.start+days), [endField]: dayDate(range.end+days) };
}
export function calendarDrop(item: Entity, field: string, target: number, endField: string) {
  const previous = dateDay(item[field]);
  if (previous !== null && dateDay(item.startDate) !== null && dateDay(item[endField]) !== null)
    return moveSchedule(item,endField,target-previous);
  const patch: Record<string,string> = {[field]:dayDate(target)};
  const other = dateDay(item[field==='startDate'?endField:'startDate']);
  if (other !== null && (field==='startDate'?target>other:target<other)) patch[field==='startDate'?endField:'startDate']=dayDate(target);
  return patch;
}
export function scheduleDependencies(items: Entity[]) {
  const visible = new Set(items.map(i=>i.id)), edges = new Map<string,{from:string;to:string}>();
  for (const item of items) for (const relation of item.relations || []) {
    const pair = ['blocks','blocking'].includes(relation.type) ? {from:item.id,to:relation.issueId} : ['blockedBy','blocked_by'].includes(relation.type) ? {from:relation.issueId,to:item.id} : null;
    if (pair && visible.has(pair.from) && visible.has(pair.to) && pair.from!==pair.to) edges.set(pair.from+':'+pair.to,pair);
  }
  return [...edges.values()];
}
