/* Build injects SHELL_CACHE and SHELL_FILES. Only public application files enter
   this cache. Authentication, API responses and uploaded media never do. */
const shellPaths=new Set(SHELL_FILES);
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil((async () => {
  const route=event.notification.data?.route;
  if(typeof route!=='string'||!route.startsWith('/')||route.startsWith('//'))return;
  const target=new URL(route,self.location.origin);
  if(target.origin!==self.location.origin)return;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>new URL(client.url).origin===target.origin);
  if(existing){await existing.navigate(target.href);await existing.focus();}
  else await self.clients.openWindow(target.href);
 })());
});
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(SHELL_CACHE);
 for(let index=0;index<SHELL_FILES.length;index+=8)await Promise.all(SHELL_FILES.slice(index,index+8).map(async path=>{
  const response=await fetch(new Request(path,{cache:'reload',credentials:'omit'}));
  if(!response.ok)throw Error('App cache could not load '+path);
  await cache.put(path,response);
 }));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=(await caches.keys()).filter(key=>key.startsWith('parabolic-shell-'));
 const keep=new Set([SHELL_CACHE,...keys.filter(key=>key!==SHELL_CACHE).slice(-1)]);
 await Promise.all(keys.filter(key=>!keep.has(key)).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'&&!/^\/(api|auth|oauth|mcp|graphql|\.well-known)(\/|$)/.test(url.pathname)){
  event.respondWith((async()=>{try{return await fetch(request)}catch{const shell=await(await caches.open(SHELL_CACHE)).match('/index.html');return shell||Response.error()}})());return;
 }
 if(shellPaths.has(url.pathname)&&url.pathname!=='/index.html')event.respondWith((async()=>{
  const cache=await caches.open(SHELL_CACHE),cached=await cache.match(url.pathname);
  return cached||fetch(request);
 })());
});
