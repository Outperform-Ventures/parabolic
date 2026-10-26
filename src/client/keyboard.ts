import {isCompositionKey} from './composition-key';
/** Native reference: audit/keyboard-shortcuts.md. Mapping is separate from action execution. */
export type ShortcutScope = 'global' | 'list' | 'issue' | 'project' | 'initiative' | 'timeline' | 'inbox';
export interface WorkspaceCommand { command: string; route?: string; field?: string; value?: string | number | boolean }
export interface ShortcutContext {
  scope: ShortcutScope;
  entity?: 'issue' | 'project' | 'initiative' | 'document';
  typing?: false | 'input' | 'editor';
  modalOpen?: boolean;
  platform?: 'mac' | 'other';
  teamId?: string;
  cyclesEnabled?: boolean;
  currentCycleId?: string;
  upcomingCycleId?: string;
  submitOnCommandEnter?: boolean;
  triageIssueId?:string;
}
export interface ShortcutEvent { key: string; keyCode?: number; code?: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean; isComposing?: boolean }
export interface ShortcutSequence { key: string; at: number }
export interface ShortcutResolution { action: WorkspaceCommand | null; pending: ShortcutSequence | null; preventDefault: boolean }
export interface ShortcutDefinition { id: string; label: string; binding: string; scope: string }
const action = (command: string, extra: Omit<WorkspaceCommand, 'command'> = {}): WorkspaceCommand => ({ command, ...extra });
const done = (command: WorkspaceCommand | null): ShortcutResolution => ({ action: command, pending: null, preventDefault: !!command });
const punctuation: Record<string, string> = { BracketLeft: '[', BracketRight: ']', Period: '.', Comma: ',', Quote: "'", Slash: '/', Minus: '-', Equal: '=', Backquote: '`', Backslash: '\\', Space: ' ' };
function keyOf(event: ShortcutEvent) {
  if (event.code && (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey)) {
    if (punctuation[event.code]) return punctuation[event.code];
    if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
    if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  }
  return event.key.toLowerCase();
}

/** Pure lookup: the caller owns focus detection, preventDefault, and dispatch. */
export function resolveShortcut(event: ShortcutEvent, context: ShortcutContext, previous?: ShortcutSequence | null, now = Date.now()): ShortcutResolution {
  if (isCompositionKey(event)) return done(null);
  const key = keyOf(event); const mac = context.platform !== 'other';
  const mod = mac ? !!event.metaKey : !!event.ctrlKey;
  const control = mac && !!event.ctrlKey; const alt = !!event.altKey; const shift = !!event.shiftKey;
  const bare = !mod && !control && !alt; const plain = bare && !shift;
  const entity = context.entity ?? (['issue', 'project', 'initiative'].includes(context.scope) ? context.scope : undefined);
  const entityCommand = (command: string, extra: Omit<WorkspaceCommand, 'command'> = {}) => action(command, { ...extra, ...(extra.value === undefined && entity ? { value: entity } : {}) });
  const field = (value: string) => entityCommand('edit-property', { field: value });
  let result: WorkspaceCommand | null = null;

  // These controls belong to the application, even while a text field has focus.
  if (mod && !control) {
    if (key === 't' && !alt) result = action(shift ? 'reopen-tab' : 'new-tab');
    else if (key === 'w' && !shift) result = action(alt ? 'close-other-tabs' : 'close-tab');
    else if (!alt && shift && [']', 'arrowright'].includes(key)) result = action('next-tab');
    else if (!alt && shift && ['[', 'arrowleft'].includes(key)) result = action('previous-tab');
    else if (!alt && !shift && /^[1-9]$/.test(key)) result = action('select-tab', { value: key === '9' ? 'last' : Number(key) - 1 });
    else if (key === 'a' && shift && !alt && !context.typing) result = action('open-tab-menu');
    else if (key === ',' && !shift && !alt) result = action('settings');
    else if (key === '/' && !shift && !alt) result = action('keyboard-shortcuts');
    else if (key === 'f' && !shift && !alt) result = action('find-in-page');
    else if (key === 'g' && !alt) result = action(shift ? 'find-previous' : 'find-next');
    else if (key === 'k' && !shift && !alt && context.typing !== 'editor') result = action('command-menu');
    else if (mac && key === 'y' && !shift && !alt && context.typing !== 'editor') result = action('open-recently-viewed');
    else if (key === 'o' && shift && !alt && entity === 'issue' && !context.modalOpen) result = action('new-sub-issue');
    else if(key==='o'&&alt&&!shift)result=action('open-last-toast-link');
    else if (key === 'enter' && !alt && !shift && context.submitOnCommandEnter) result = action('submit');
  }
  if (result) return event.repeat ? done(null) : done(result);
  if ((control || (!mac && mod)) && key === 'tab' && !alt) return done(action(shift ? 'previous-tab' : 'next-tab'));
  if (context.typing || context.modalOpen) return done(null);
  if(bare&&key==='backspace')return event.repeat?done(null):done(action(shift?'forward':'back'));
  if(plain&&['browserback','browserforward'].includes(key))return event.repeat?done(null):done(action(key==='browserback'?'back':'forward'));
  if(!event.repeat&&mod&&!control&&shift&&!alt&&key==='i'&&context.scope==='list'&&entity==='issue')return done(action('toggle-insights'));
  if(plain&&!event.repeat&&context.triageIssueId){const commands:Record<string,string>={'1':'triage-accept','2':'triage-duplicate','3':'triage-decline',h:'triage-snooze'};if(commands[key])return done(action(commands[key],{value:context.triageIssueId}));}
  if(!event.repeat&&key==='r'&&!shift&&((mac&&control&&!mod&&!alt)||(!mac&&mod&&alt)) )return done(action('new-customer-request'));

  if (previous && now - previous.at >= 0 && now - previous.at < 1200 && plain) {
    if (previous.key === 'g') {
      const routes: Record<string, string> = { i: '/inbox', m: '/my-issues', p: '/projects', s: '/settings', n: '/initiatives', q: '/customers', '-': '/dashboards' };
      if (routes[key]) result = action('navigate', { route: routes[key] });
      const teamSections: Record<string, string> = { t: 'triage', a: 'active', b: 'backlog', x: 'archive', e: 'all', c: 'cycles' };
      if (teamSections[key] && context.teamId && (key !== 'c' || context.cyclesEnabled !== false)) result = action('navigate', { route: key === 'x' ? `/archive?team=${encodeURIComponent(context.teamId)}` : `/team/${encodeURIComponent(context.teamId)}/${teamSections[key]}` });
      if (key === 'c' && !context.teamId) result = action('navigate', { route: '/cycles' });
      if (key === 'd') result = action('open-drafts');
      if (key === 'v') result = context.currentCycleId ? action('navigate', { route: `/cycles/${encodeURIComponent(context.currentCycleId)}` }) : action('open-current-cycle');
      if (key === 'w') result = context.upcomingCycleId ? action('navigate', { route: `/cycles/${encodeURIComponent(context.upcomingCycleId)}` }) : action('open-upcoming-cycle');
    } else if (previous.key === 'o') {
      const types: Record<string, string> = { i: 'issue', l: 'label', f: 'favorite', p: 'project', c: 'cycle', u: 'user', t: 'team', v: 'view', d: 'document', n: 'initiative', q: 'customer', w: 'workspace' };
      if (types[key]) result = action('open-picker', { value: types[key] });
      if (key === 's') result = action('settings');
    } else if (previous.key === 'n') {
      if (key === 'p') result = action('new-project');
      if (key === 'o' && entity === 'initiative') result = field('ownerId');
    } else if (previous.key === 'p' && entity === 'project') {
      const fields: Record<string, string> = { s: 'status', p: 'priority', n: 'initiativeIds', a: 'leadId', m: 'memberIds', t: 'teamIds', l: 'labelIds' };
      if (fields[key]) result = field(fields[key]);
    } else if (previous.key === 'm' && entity === 'issue') {
      const relations: Record<string, string> = { b: 'blockedBy', x: 'blocking', r: 'related', m: 'duplicate' };
      if (relations[key]) result = action('add-relation', { value: relations[key] });
    }
    if (result) return done(result);
  }
  if (plain && (['g', 'o', 'n'].includes(key) || (key === 'p' && entity === 'project') || (key === 'm' && entity === 'issue' && context.scope !== 'timeline'))) return { action: null, pending: { key, at: now }, preventDefault: true };

  if (mod && !control) {
    if(!alt&&key==='z')result=action(shift?'redo':'undo');
    else if(!mac&&!alt&&!shift&&key==='y')result=action('redo');
    else if (!alt && !shift && key === 'f') result = action('find-in-page');
    else if (!alt && key === 'g') result = action(shift ? 'find-previous' : 'find-next');
    else if (!alt && shift && key === 'c') result = action('copy-page-url');
    else if (!alt && !shift && key === '[') result = action('back');
    else if (!alt && !shift && key === ']') result = action('forward');
    else if (alt && !shift && key === 'o') result = action('open-last-toast-link');
    if (entity) {
      if (!alt && shift && key === ',') result = entityCommand('copy-entity-url');
      if (!alt && shift && key === "'") result = entityCommand('copy-entity-title');
      if (entity === 'issue') {
        if (mac && !alt && !shift && key === 'c') result = action('copy-issue-title-link');
        if (!alt && !shift && key === '.') result = action('copy-issue-id');
        if (alt && !shift && key === 'c') result = action('copy-issue-markdown');
        if (!alt && !shift && key === 'backspace') result = action('delete-issue');
        if (!alt && shift && key === 'd') result = action('set-property', { field: 'dueDate', value: '' });
        if (!alt && shift && key === 'm') result = field('teamId');
        if (!alt && shift && key === 's') result = action('manage-subscribers');
        if (!alt && shift && key === 'o') result = action('new-sub-issue');
        if (!alt && shift && key === 'p') result = field('parentId');
        if (!alt && shift && key === 'arrowup') result = action('open-parent-issue');
        if (!alt && shift && key === 'arrowdown') result = action('open-sub-issue');
      } else if (entity === 'document') {
        if (alt && !shift && key === 'c') result = action('copy-document-markdown');
      } else if ((entity==='project'||entity==='initiative') && !alt && key === 'u') result = entityCommand(shift ? 'write-update' : 'open-updates');
    }
    if (context.scope === 'list' || context.scope === 'timeline') {
      if (key === 'a' && !shift) result = action(alt ? 'select-group' : 'select-all');
      if (context.scope === 'list' && key === 'b' && !shift && !alt) result = action('toggle-layout');
    }
  } else if (control) {
    if (!alt && shift && /^[1-9]$/.test(key)) result = action('select-team', { value: Number(key) - 1 });
    if (!alt && shift && key === 'p') result = action('pin-tab');
    if (entity === 'issue') {
      if (!alt && shift && key === 'i') result = action('focus-description');
      if (!alt && shift && key === 'l') result = action('toggle-links');
      if (!alt && !shift && key === 'l') result = action('link-url');
      if (!alt && !shift && key === 'm') result = action('focus-comment');
      if (alt && shift && key === 't') result = action('apply-template');
    }
    if (alt && !shift && (entity === 'project' || entity === 'initiative')) {
      if (key === 'd') result = field('targetDate');
      if (key === 's' && entity === 'project') result = field('startDate');
    }
  } else if (alt) {
    if (shift && key === 'q') result = action('logout');
    if (!shift && key === 'c') result = action('new-issue-template');
    if (!shift && key === 'v' && context.scope==='list') result=action('save-view');
    if (!shift && key === 'f' && entity) result = entityCommand('toggle-favorite');
    if (context.scope === 'inbox' && !shift && key === 'u') result = action('mark-all-read');
    if (context.scope === 'list') {
      if (shift && key === 'f') result = action('clear-filters');
      if (!shift && key === 't') result = action('toggle-all-groups');
      const positions: Record<string, string> = { arrowup: shift ? 'top' : 'up', arrowdown: shift ? 'bottom' : 'down', arrowleft: 'left', arrowright: 'right' };
      if (positions[key]) result = action('reorder-item', { value: positions[key] });
    }
  } else {
    if (plain && key === 'c') result = action('new-issue');
    if (plain && key === 'v') result = action('new-issue-expanded');
    if (plain && key === '/') result = action('search');
    if ((shift && key === '/') || event.key === '?') result = action('help-menu');
    if (plain && key === '[') result = action('toggle-sidebar');
    if (plain && key === ']') result = action('toggle-right-sidebar');
    if (bare && shift && key === 'v') result = action('display-options');
    if (entity) {
      if (key === 'h') result = entityCommand('remind');
      if (entity === 'project' && shift && key === 'r') result = action('rename-project');
      if (entity === 'issue') {
        const fields: Record<string, string> = shift ? { e: 'estimate', d: 'dueDate', c: 'cycleId', p: 'projectId', m: 'milestoneId' } : { a: 'assigneeId', l: 'labelIds', s: 'statusId', p: 'priority' };
        if (fields[key]) result = field(fields[key]);
        if (!shift && key === 'i') result = action('assign-to-me');
        if (shift && key === 'r') result = action('rename-issue');
        if (shift && key === 's') result = action('toggle-subscription');
        if (event.key === '#') result = action('restore-issue');
        if (!shift && key === 'r') result = action('reply-comment');
      }
    }
    if (context.scope === 'list') {
      if (plain && ['arrowup', 'k', 'arrowdown', 'j', 'arrowleft', 'arrowright'].includes(key)) result = action('focus-item', { value: ['arrowup', 'k'].includes(key) ? 'up' : ['arrowdown', 'j'].includes(key) ? 'down' : key === 'arrowleft' ? 'left' : 'right' });
      if (shift && ['arrowup', 'arrowdown'].includes(key)) result = action('extend-selection', { value: key === 'arrowup' ? 'up' : 'down' });
      if (plain && key === 'enter') result = action('open-focused-item');
      if (plain && key === ' ') result = action('peek-item');
      if (bare && key === 'x') result = action('toggle-selection', shift ? { value: 'extend-current' } : {});
      if (plain && key === 'escape') result = action('clear-selection');
      if (plain && key === 't') result = action('toggle-group');
      if (key === 'f') result = action(shift ? 'clear-last-filter' : 'add-filter');
    }
    if (context.scope === 'inbox') {
      if(plain&&['arrowup','arrowdown','j','k'].includes(key))result=action('focus-item',{value:['arrowup','k'].includes(key)?'up':'down'});
      if(plain&&key==='delete')result=action('delete-notification');
      if (plain && key === 'u') result = action('toggle-read');
      if (plain && key === 'h') result = action('snooze-notification');
      if (shift && key === 'delete') result = action('delete-read-notifications');
    }
    if (context.scope === 'timeline') {
      const zoom: Record<string, string> = { '-': 'out', '=': 'in', y: 'year', q: 'quarter', m: 'month', w: 'week' };
      if (plain && zoom[key]) result = action('timeline-zoom', { value: zoom[key] });
      if (plain && key === 'x') result = action('toggle-selection');
      if (plain && key === 'escape') result = action('clear-selection');
      if (plain && ['arrowleft', 'arrowright'].includes(key)) result = action('timeline-select', { value: key === 'arrowleft' ? 'previous' : 'next' });
      if (shift && key === '[') result = action('timeline-toggle-list');
    }
    if (!result && plain && key === 'escape') result = action('back');
  }
  if (event.repeat && result && !['focus-item', 'extend-selection', 'timeline-zoom', 'timeline-select', 'reorder-item'].includes(result.command)) return done(null);
  return done(result);
}
