// Observed native paths: artifacts/visual-parity/native/lower-sidebar-icons-ax.txt.
const paths = {
  "home": [
    "M2.75 14.25V6.48a.75.75 0 0 1 .242-.553l4.5-4.136a.75.75 0 0 1 1.016 0l4.5 4.136a.75.75 0 0 1 .242.553v7.77h-3.5v-3.267a1.75 1.75 0 0 0-3.5 0v3.267h-3.5Z"
  ],
  "issues": [
    "M13.25 5.25C14.2165 5.25 15 6.0335 15 7V11.75C15 13.5449 13.5449 15 11.75 15H6.75C5.7835 15 5 14.2165 5 13.25C5 12.8358 5.33579 12.5 5.75 12.5C6.16421 12.5 6.5 12.8358 6.5 13.25C6.5 13.3881 6.61193 13.5 6.75 13.5H11.75C12.7165 13.5 13.5 12.7165 13.5 11.75V7C13.5 6.86193 13.3881 6.75 13.25 6.75C12.8358 6.75 12.5 6.41421 12.5 6C12.5 5.58579 12.8358 5.25 13.25 5.25Z",
    "M8.1543 1.00391C9.73945 1.08421 11 2.39489 11 4V8L10.9961 8.1543C10.9184 9.68834 9.68834 10.9184 8.1543 10.9961L8 11H4L3.8457 10.9961C2.31166 10.9184 1.08163 9.68834 1.00391 8.1543L1 8V4C1 2.39489 2.26055 1.08421 3.8457 1.00391L4 1H8L8.1543 1.00391ZM4 2.5C3.17157 2.5 2.5 3.17157 2.5 4V8C2.5 8.82843 3.17157 9.5 4 9.5H8C8.82843 9.5 9.5 8.82843 9.5 8V4C9.5 3.17157 8.82843 2.5 8 2.5H4Z"
  ],
  "disclosure": [
    "M7.00194 10.6239C6.66861 10.8183 6.25 10.5779 6.25 10.192V5.80802C6.25 5.42212 6.66861 5.18169 7.00194 5.37613L10.7596 7.56811C11.0904 7.76105 11.0904 8.23895 10.7596 8.43189L7.00194 10.6239Z"
  ]
};

export function NativeTeamNavigationIcon({name}: {name:'Home'|'Issues'}) {
  return <svg className="icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">{name==='Home'?<path d={paths.home[0]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>:paths.issues.map(d=><path key={d} d={d} fillRule="evenodd" clipRule="evenodd"/>)}</svg>;
}

export function NativeSidebarDisclosure({expanded,team=false}: {expanded:boolean;team?:boolean}) {
  return <svg className={`sidebar-disclosure ${team?'team-disclosure':''}`} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{transform:expanded?'rotate(90deg)':undefined}} aria-hidden="true" focusable="false"><path d={paths.disclosure[0]}/></svg>;
}
