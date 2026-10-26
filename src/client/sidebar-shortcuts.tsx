import React from 'react';

// Workspace destinations only: team shortcuts depend on the current team, so
// attaching G then E to every team's Issues link would advertise the wrong route.
export const sidebarNavigationShortcuts: Record<string, string> = {
  '/inbox': 'I',
  '/my-issues': 'M',
  '/drafts': 'D',
  '/initiatives': 'N',
  '/projects': 'P',
  '/customers': 'Q',
};

export function SidebarShortcut({ path }: { path: string }) {
  const key = sidebarNavigationShortcuts[path];
  return key ? (
    <span className="sidebar-shortcut-hint" aria-hidden="true">
      <kbd>G</kbd><span>then</span><kbd>{key}</kbd>
    </span>
  ) : null;
}
