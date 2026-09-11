export const customerQuickFields=[['customerIds','Customer name'],['customerCount','Customer count'],['customerImportantCount','Important customer count'],['customerOwnerIds','Customer owner'],['customerStatus','Customer status'],['customerTier','Customer tier'],['customerRevenueValues','Customer revenue'],['customerSizeValues','Customer size']] as const;
export const numericCustomerFields=new Set(['customerCount','customerImportantCount','customerRevenueValues','customerSizeValues']);
export const customerComparisons=[['gte','greater than or equals'],['lte','less than or equals'],['eq','equals'],['neq','not equals']] as const;
/** Revenue and company-size filters match a linked customer, not the sum across customers. */
export function matchCustomerValue(entity:any,condition:{field:string;operator:string;value?:any}):boolean|undefined{
 if(!['customerRevenueValues','customerSizeValues'].includes(condition.field))return;
 const values=entity[condition.field]??[],expected=Number(condition.value);
 if(condition.operator==='empty'||condition.operator==='isEmpty')return values.length===0;
 if(condition.operator==='notEmpty')return values.length>0;
 if(!Number.isFinite(expected))return false;
 const compare=({gte:(a:number)=>a>=expected,lte:(a:number)=>a<=expected,gt:(a:number)=>a>expected,lt:(a:number)=>a<expected,eq:(a:number)=>a===expected,is:(a:number)=>a===expected,equals:(a:number)=>a===expected,neq:(a:number)=>a!==expected,isNot:(a:number)=>a!==expected} as Record<string,(a:number)=>boolean>)[condition.operator];
 return compare?values.some((v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&compare(v)):undefined;
}
