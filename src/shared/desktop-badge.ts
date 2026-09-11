export type DesktopBadgeMode='off'|'indicator'|'count';
export function desktopBadgeMode(preferences:Record<string,any>):DesktopBadgeMode {
  return ['off','indicator','count'].includes(preferences.notificationBadgeMode)?preferences.notificationBadgeMode:preferences.notificationBadge===false?'off':'indicator';
}
export function desktopBadgeText(count:number,mode:DesktopBadgeMode){return count>0&&mode!=='off'?mode==='indicator'?'•':String(count):'';}
