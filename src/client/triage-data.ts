import type {Entity} from '../shared/types';
import type {FilterSpec} from './query';
export function filterIncludesTriage(filter:FilterSpec,statuses:Entity[]){const ids=new Set(statuses.filter(status=>status.type==='triage').map(status=>status.id));return filter.conditions.some(condition=>['statusId','status'].includes(condition.field)&&['eq','in','contains'].includes(condition.operator)&&(Array.isArray(condition.value)?condition.value:[condition.value]).some(value=>ids.has(String(value))||condition.field==='status'&&value==='triage'))}
