import type { SVGProps } from 'react';

// Observed native glyphs, preserved in artifacts/visual-parity/native/issue-icons-ax.txt.
export function NativePriorityGlyph({priority}: {priority: number}) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
    {priority === 1 ? <path d="M3 1C1.91067 1 1 1.91067 1 3V13C1 14.0893 1.91067 15 3 15H13C14.0893 15 15 14.0893 15 13V3C15 1.91067 14.0893 1 13 1H3ZM7 4L9 4L8.75391 8.99836H7.25L7 4ZM9 11C9 11.5523 8.55228 12 8 12C7.44772 12 7 11.5523 7 11C7 10.4477 7.44772 10 8 10C8.55228 10 9 10.4477 9 11Z"/> : priority === 0 ? <>
      {[1.5,6.5,11.5].map(x=><rect key={x} x={x} y="7.25" width="3" height="1.5" rx=".5" opacity=".9"/>)}
    </> : <>
      <rect x="1.5" y="8" width="3" height="6" rx="1"/>
      <rect x="6.5" y="5" width="3" height="9" rx="1" fillOpacity={priority === 4 ? .4 : 1}/>
      <rect x="11.5" y="2" width="3" height="12" rx="1" fillOpacity={priority >= 3 ? .4 : 1}/>
    </>}
  </svg>;
}

export function NativeStatusGlyph({type, ...props}: SVGProps<SVGSVGElement> & {type: 'started'|'backlog'|'completed'}) {
  return <svg {...props} width="100%" height="100%" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
    <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={type === 'backlog' ? '1.4 1.74' : '3.14 0'} strokeDashoffset={type === 'backlog' ? '.65' : '-.7'}/>
    {type === 'completed' ? <>
      <circle cx="7" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="18.84955592153876 37.69911184307752" strokeDashoffset="0" transform="rotate(-90 7 7)"/>
      <path stroke="none" fill="var(--bg)" d="M10.951 4.24896C11.283 4.58091 11.283 5.11909 10.951 5.45104L5.95104 10.451C5.61909 10.783 5.0809 10.783 4.74896 10.451L2.74896 8.45104C2.41701 8.11909 2.41701 7.5809 2.74896 7.24896C3.0809 6.91701 3.61909 6.91701 3.95104 7.24896L5.35 8.64792L9.74896 4.24896C10.0809 3.91701 10.6191 3.91701 10.951 4.24896Z"/>
    </> : <circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="11.309733552923255 22.61946710584651" strokeDashoffset={type === 'started' ? '5.654866776461628' : '11.309733552923255'} transform="rotate(-90 7 7)"/>}
  </svg>;
}
