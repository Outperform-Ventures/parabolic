const dayNumber=(date:Date)=>Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000;
export function parseDueDate(value:string){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 const date=match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12):new Date(value);
 if(!Number.isFinite(date.getTime()))return null;
 return date;
}
export function dueDatePresentation(value:string,now:Date=new Date()){
 const date=parseDueDate(value);if(!date)return null;
 const days=dayNumber(date)-dayNumber(now),tone=days<=0?'urgent':days<=7?'soon':'later';
 const relative=days===0?'Due today':days<0?`${-days} ${days===-1?'day':'days'} overdue`:`Due in ${days} ${days===1?'day':'days'}`;
 return {date,days,tone,relative};
}
