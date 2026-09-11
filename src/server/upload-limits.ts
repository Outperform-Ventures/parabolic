// A deployment memory/transport guard, never a workspace billing entitlement.
// The current attachment store buffers uploads; operators may tune this bound.
export const defaultUploadMaxBytes=256*1024*1024;
export function uploadMaxBytes(configured:unknown=process.env.PARABOLIC_UPLOAD_MAX_BYTES){
 if(configured===undefined||configured==='')return defaultUploadMaxBytes;
 const value=Number(configured);
 if(!Number.isSafeInteger(value)||value<=0||value>Math.floor(Number.MAX_SAFE_INTEGER/2))throw new Error('PARABOLIC_UPLOAD_MAX_BYTES must be a positive safe byte count');
 return value;
}
export function uploadBodyLimit(maxBytes:number,encoding:'multipart'|'base64'|'raw'){
 return encoding==='raw'?maxBytes:(encoding==='base64'?Math.ceil(maxBytes/3)*4:maxBytes)+1024*1024;
}
