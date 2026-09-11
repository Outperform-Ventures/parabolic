import { createHash } from 'node:crypto';

export function desktopSessionPartition(origin:string,embedded:boolean):string {
  return embedded?'persist:parabolic':`persist:parabolic-remote-${createHash('sha256').update(new URL(origin).origin).digest('hex').slice(0,32)}`;
}

/** No credentials, javascript:, file:, or arbitrary OS protocols may leave the renderer. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
export function routeFromDeepLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'parabolic:' || url.username || url.password || url.port) return null;
    // Both parabolic://issues/id and parabolic:///issues/id address the shared router.
    const route = `/${url.hostname}${url.pathname}`.replace(/\/{2,}/g, '/');
    return safeRoute(`${route}${url.search}${url.hash}`);
  } catch { return null; }
}
export function safeRoute(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192 || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n\0]/.test(value)) return null;
  try { const url = new URL(value, 'https://parabolic.invalid'); return url.origin === 'https://parabolic.invalid' ? url.pathname + url.search + url.hash : null; } catch { return null; }
}
export function trustedRendererUrl(value: string, rendererOrigin: string): boolean {
  try { return new URL(value).origin === rendererOrigin; } catch { return false; }
}
export function safeServerUrl(value:unknown):string|null {
  if(typeof value!=='string'||value.length>8192)return null;
  try{const url=new URL(value.trim());if(url.username||url.password||url.search||url.hash||url.pathname!=='/')return null;if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))return null;return url.origin;}catch{return null;}
}
export function validNotificationTag(value:unknown):value is string|undefined{return value===undefined||typeof value==='string'&&value.length>0&&value.length<=512&&!/[\u0000-\u001f\u007f]/.test(value);}
/** Shared by every BrowserWindow; monotonic time prevents wall-clock changes from extending suppression. */
export class NotificationDeduper {
  private readonly recent=new Map<string,number>();
  constructor(private readonly ttlMs=600_000,private readonly maxTags=2048){}
  get size(){return this.recent.size;}
  accept(tag:string|undefined,now=performance.now()):boolean{
    if(!validNotificationTag(tag))throw new Error('Invalid notification tag');
    if(tag===undefined)return true;
    for(const [key,at] of this.recent){if(now-at>=this.ttlMs)this.recent.delete(key);else break;}
    if(this.recent.has(tag))return false;
    while(this.recent.size>=this.maxTags)this.recent.delete(this.recent.keys().next().value!);
    this.recent.set(tag,now);return true;
  }
}
