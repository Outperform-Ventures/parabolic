import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

// Run against one existing immutable dist/ build. Build the app before starting
// this suite; rebuilding midway can invalidate lazy-loaded asset filenames.
export default defineConfig({
  testDir: '..',
  testMatch: [
    'platform/{restart-uploads,desktop-restart-saves,keyboard,properties,oauth,collaboration,shared-shortcuts,subissue-selection,quick-open,profile,inline-emoji,reminders,tab-cleanup,tab-history,workspace-menu}.spec.ts',
    'client/{configuration,issues,board,customers,updates,sharing,subissues,lifecycle,archive,search,appearance,font-preferences,reactions,offline-shell,inbox,inbox-focus,inbox-stacks,inbox-timing,inbox-bulk,history-race,notifications,favorites,view-insights,view-summary,insight-resilience,modal-focus,comment-drafts,comment-threads}.spec.ts',
    'product/{due-notifications,requester-attribution,template-assets,requester-portal,requester-account,asks-requester-auth,template-uploads,direct-asks,asks-pages,view-subscriptions,workflows,project-views,project-activity,document-history,document-heading-links,document-authorship,document-context,entity-links,due-date,recurring-issues,cycle-addition,cycle-offline,creator-filter,subscription-toggle,subscriber-filter,manage-subscribers,subscriber-concurrency,label-views,label-views-offline,label-filter,filter-groups,route-filter,relative-date-filter,label-create,label-description,project-label-groups,routing-labels,template-labels,project-label-columns,project-label-grouping,project-label-filter,project-label-insights,issue-project-label-groups,project-label-merge,label-names,label-groups,label-conversion,group-display-identity,group-name-case,label-settings,label-bulk,project-inline,project-bulk,subgroups,triage,initiative-graph,editor-attachments,editor-toolbar,issue-inline-comments}.spec.ts',
  ],
  workers: 1,
  retries: 0,
  outputDir: '../../artifacts/platform/engine-traces',
  reporter: [['list'], ['json', { outputFile: resolve('artifacts/platform/browser-engines.json') }]],
  use: { headless: true, viewport: { width: 1280, height: 800 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'webkit', use: { browserName: 'webkit', launchOptions: process.env.PARABOLIC_WEBKIT_EXECUTABLE ? { executablePath: process.env.PARABOLIC_WEBKIT_EXECUTABLE } : undefined } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
