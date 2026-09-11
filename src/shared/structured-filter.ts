export class UnsupportedStructuredFilter extends Error {}
const stringOnlyOperators=new Set(['eqIgnoreCase','neqIgnoreCase','notStartsWith','endsWith','notEndsWith','notContains','containsIgnoreCase','notContainsIgnoreCase']);
/** Evaluate structured API filters; callers provide their condition-block semantics. */
export function matchesStructuredFilter(entity:any,filter:Record<string,any>,nested:(entity:any,filter:any)=>boolean,fail:(message:string)=>never=(message)=>{throw new UnsupportedStructuredFilter(message)}):boolean{
 return Object.entries(filter).every(([key,value])=>{
  if(key==='and')return Array.isArray(value)&&value.every(child=>nested(entity,child));
  if(key==='or')return Array.isArray(value)&&value.some(child=>nested(entity,child));
  if(key==='not')return !nested(entity,value);
  const actual=key.split('.').reduce((object,part)=>object?.[part],entity);
  if(value===null||typeof value!=='object'||Array.isArray(value))return Array.isArray(value)?value.includes(actual):actual===value;
  return Object.entries(value).every(([operator,expected]:[string,any])=>{
   if(stringOnlyOperators.has(operator)&&typeof expected!=='string')return fail('String filter requires a string value');
   switch(operator){
    case'eq':return actual===expected;
    case'neq':return actual!==expected;
    case'in':return Array.isArray(expected)&&expected.includes(actual);
    case'nin':return Array.isArray(expected)&&!expected.includes(actual);
    case'contains':return Array.isArray(actual)?actual.includes(expected):typeof actual==='string'&&actual.includes(String(expected));
    case'notContains':return typeof actual==='string'&&!actual.includes(String(expected));
    case'eqIgnoreCase':return typeof actual==='string'&&actual.toLowerCase()===String(expected).toLowerCase();
    case'neqIgnoreCase':return typeof actual==='string'&&actual.toLowerCase()!==String(expected).toLowerCase();
    case'containsIgnoreCase':return typeof actual==='string'&&actual.toLowerCase().includes(String(expected).toLowerCase());
    case'notContainsIgnoreCase':return typeof actual==='string'&&!actual.toLowerCase().includes(String(expected).toLowerCase());
    case'containsAll':if(!Array.isArray(expected))return fail('containsAll requires an array');return Array.isArray(actual)&&expected.every(value=>actual.includes(value));
    case'startsWith':return typeof actual==='string'&&actual.startsWith(String(expected));
    case'notStartsWith':return typeof actual==='string'&&!actual.startsWith(String(expected));
    case'endsWith':return typeof actual==='string'&&actual.endsWith(String(expected));
    case'notEndsWith':return typeof actual==='string'&&!actual.endsWith(String(expected));
    case'gt':return actual>expected;
    case'gte':return actual>=expected;
    case'lt':return actual<expected;
    case'lte':return actual<=expected;
    case'null':return expected?actual==null:actual!=null;
    case'some':return Array.isArray(actual)&&actual.some(value=>nested(value,expected));
    default:return fail('Unsupported filter operator: '+operator);
   }
  });
 });
}
