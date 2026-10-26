import {NativeSettingsIcon} from '../components/settings-icons';
import {EntityIcon} from './entity-icon';
import {SidebarHelp} from '../sidebar-navigation';
import {ShortcutReference} from '../shortcut-reference';
import {useSidebarReturnDestination} from '../sidebar-destinations';
import {SidebarCustomizationButton} from '../sidebar-navigation';
import {guestCapabilities} from '../../shared/guest-capabilities';
import {ApprovedDomains} from "./approved-domains";
import {ProfileEmail} from "./profile-email";
import {TeamLifecycleControls} from "./team-lifecycle";
import {desktopBadgeMode} from '../../shared/desktop-badge';
import {patchUserPreferences} from '../store';
import {TeamNestingWizard} from './team-nesting';
import {WorkspaceInviteLink} from './workspace-invite-link';
import {WorkspaceDeletion} from './workspace-deletion';
import {AsksPagesSettings} from './asks-pages';
import {AsksRequesters} from './asks-requesters';
import {ViewSubscriptionSettings} from '../view-subscriptions';
import {RecurringIssueSettings} from '../recurring-issues';
import {useLocalFontSize,setLocalFontSize} from '../local-font-preference';
import {LabelGroups} from './label-groups';
import {buildLabelUsage} from './label-usage';
import {memberJoinedLabel} from '../member-joined';
import {LabelBulk} from './label-bulk';
import {LabelInline} from './label-inline';
import './settings-visual.css';
import './settings-responsive.css';
import {WorkflowStatuses} from './workflow-statuses';
import {ApplicationForm} from './application-form';
import {CycleSettings} from './cycle-settings';
import {TriageResponsibilitySettings,TriageRules} from './triage-settings';
import {ProfileAvatar} from './profile-avatar';
import {CustomEmojisSettings} from './custom-emojis';
import {CustomThemeControls} from './custom-theme';
import {EntityIconPicker} from './entity-icon';
import {apiRequest} from '../store';
import {FONT_SIZE_OPTIONS} from '../font-scale';
import {UpdateSettings} from "./updates";
import {Button,Dropdown,Icon,MenuItem} from "../components/ui";
import { CustomerRequestSettings } from "./customers";
import { ProjectStatusSettings } from "./project-statuses";
import { TemplatesSettings } from "../templates";
import { SlaSettings } from "../slas";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams,useLocation,useSearchParams } from "react-router-dom";
import {
  Settings,
  SlidersHorizontal,
  UserRound,
  Bell,
  Shield,
  Users,
  Building2,
  Tag,
  FileText,
  Timer,
  Workflow,
  Plug,
  KeyRound,
  Webhook,
  AppWindow,
  ClipboardList,
  ArrowLeft,
  Plus,
  Copy,
  Check,
  Trash2,
  Code,
  ExternalLink,
  ArrowUpRight,
  Monitor,
  Smartphone,
  Mail,
  MessageSquare,
  CalendarDays,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  CircleDot,
  GitBranch,
  Inbox,
  Repeat2,
  Network,
  LogOut,
} from "lucide-react";
import type { Entity, EntityKind } from "../../shared/types";
import {
  Action,
  AddButton,
  Blank,
  Confirm,
  date,
  EntityMenu,
  FormDialog,
  FormField,
  Header,
  live,
  optionList,
  Person,
  MultipleProperty,
  Property,
  Row,
  SearchBox,
  Status,
  Tabs,
  useActions,
} from "./shared";

function downloadCsv(name:string, contents:string){
  const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a'); link.href=url; link.download=name; link.click(); URL.revokeObjectURL(url);
}

const navGroups = [
 {title:'Personal',items:[['preferences','Preferences',SlidersHorizontal],['profile','Profile',UserRound],['notifications','Notifications',Bell],['account-security','Security & access',Shield],['connected-accounts','Connected accounts',Plug]]},
 {title:'Issues',items:[['labels','Labels',Tag],['templates','Templates',FileText],['slas','SLAs',Timer]]},
 {title:'Projects',items:[['project-labels','Labels',Tag],['project-templates','Templates',FileText],['project-statuses','Statuses',Workflow],['project-updates','Updates',Bell]]},
 {title:'Features',items:[['initiatives','Initiatives',Bell],['documents','Documents',FileText],['customers','Customer requests',Building2],['asks','Asks',ClipboardList],['emojis','Emojis',Tag],['integrations','Integrations',Plug]]},
 {title:'Administration',items:[['workspace','Workspace',Building2],['teams','Teams',Users],['members','Members',Users],['security','Security',Shield],['api','API',KeyRound],['applications','Applications',AppWindow],['mcp','MCP access',Code]]}
];
const settingsSearchItems=[
 ['Preferences','General, home view, names, week, comments, theme, font size, sidebar, desktop, automations','/settings/preferences'],
 ['Profile','Photo, full name, title, username, email, leave workspace','/settings/profile'],
 ['Notifications','Priority inbox, desktop, mobile, email, Slack, updates','/settings/notifications'],
 ['Security & access','Sessions, password, personal API keys, authorized applications','/settings/account-security'],
 ['Connected accounts','Google, GitHub, Slack and calendar accounts','/settings/connected-accounts'],
 ['Issue labels','Workspace and team issue labels and label groups','/settings/labels'],
 ['Issue templates','Issue templates','/settings/templates'],['SLAs','Work week and SLA automation rules','/settings/slas'],
 ['Project labels','Workspace and team project labels','/settings/project-labels'],['Project templates','Project templates','/settings/project-templates'],['Project statuses','Project status categories and ordering','/settings/project-statuses'],['Project updates','Project update cadence and notifications','/settings/project-updates'],
 ['Initiatives','Initiative updates and labels','/settings/initiatives'],['Documents','Document templates','/settings/documents'],['Customer requests','Routing, statuses, tiers, display and exclusions','/settings/customers'],['Asks','Pages, forms and requester access','/settings/asks'],['Emojis','Custom emoji upload and management','/settings/emojis'],['Integrations','Integration catalog and configuration','/settings/integrations'],
 ['Workspace','Logo, name, URL, region and fiscal year','/settings/workspace'],['Teams','Team list and creation','/settings/teams'],['Members','Members, roles, invitations and access','/settings/members'],['Security','Invite links, approved domains, authentication and workspace management','/settings/security'],
 ['New user invitations','Security · who can invite workspace members','/settings/security#new-user-invitations'],['Team creation','Security · who can create teams','/settings/security#team-creation'],['File uploads','Security · restrict uploaded file types','/settings/security#restrict-file-uploads'],['Support integration privacy','Security · reduce personal information stored by support integrations','/settings/security#support-integration-privacy'],['HIPAA compliance','Security · protected health information safeguards','/settings/security#hipaa-compliance'],
 ['API','OAuth applications, webhooks and API keys','/settings/api'],['Applications','Authorized external applications','/settings/applications'],['MCP access','External MCP client access','/settings/mcp']
] as const;
function SettingsSearchResults({query,teams}:{query:string;teams:Row[]}){
 const q=query.trim().toLocaleLowerCase(),workspace=settingsSearchItems.filter(item=>(item[0]+' '+item[1]).toLocaleLowerCase().includes(q));
 const teamResults=teams.map(team=>({team,items:[['Overview','General access and permissions'],['Members','Team members and owners'],['Issue labels','Labels available to team issues'],['Templates','Issue, project and document templates'],['Recurring issues','Scheduled issue creation'],['Issue statuses','Workflow status categories'],['Workflows & automations','Issue automations and workflows'],['Triage','Team request intake'],['Cycles','Cycle schedule and automation']].filter(item=>(team.name+' '+item[0]+' '+item[1]).toLocaleLowerCase().includes(q))})).filter(group=>group.items.length);
 return <div className="settings-search-results" role="search"><section><h4>Workspace</h4>{workspace.map(([title,description,href])=><Link key={href} to={href}><span><strong>{title}</strong><small>{description}</small></span></Link>)}</section>{teamResults.map(({team,items})=><section key={team.id}><h4>{team.name}</h4>{items.map(([title,description])=><Link key={title} to={`/settings/team-${team.id}?section=${encodeURIComponent(title==='Overview'?'Overview':title.replace('Issue statuses','Workflow').replace('Workflows & automations','Workflow'))}`}><span><strong>{title}</strong><small>{description}</small></span></Link>)}</section>)}{!workspace.length&&!teamResults.length&&<p className="settings-search-empty">No settings found</p>}</div>;
}
export function SettingsPage() {
  const { section:requestedSection = "preferences",subsection } = useParams();
  const { data,user } = useActions();
  const guest=guestCapabilities(data,user?.id).guest,role=data.memberships.find(m=>!m.deletedAt&&!m.teamId&&m.userId===user?.id)?.role,admin=["owner","admin"].includes(role||""),adminSections=["workspace","members","security","integrations","slas","asks"],allowed=(id:string)=>guest?["preferences","profile","notifications","account-security","connected-accounts"].includes(id):admin||!adminSections.includes(id),section=allowed(requestedSection)?requestedSection:"preferences";
  const [search, setSearch] = useState("");
  useEffect(()=>{const id=decodeURIComponent(location.hash.slice(1));if(id)requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:'center'}))},[section]);
  const backToApp=useSidebarReturnDestination(),[shortcuts,setShortcuts]=useState(false);
  return (
    <div className="feature-settings-shell">
      <aside className="feature-settings-nav">
        <Link to={backToApp} className="feature-back">
          <ArrowLeft size={14} />
          Back to app
        </Link>
        <div className="settings-nav-scroll"><SearchBox value={search} onChange={setSearch} placeholder="Search…" />
        {search?<SettingsSearchResults query={search} teams={live(data.teams).filter(()=>!guest)}/>:navGroups.filter(group=>!guest||group.title==="Personal").map((g) => (
          <section key={g.title}>
            <h4>{g.title}</h4>
            {g.items
              .filter(([id]) => allowed(String(id)))
              .map(([id, label, Icon]) => (
                <Link
                  className={section === id ? "active" : ""}
                  key={String(id)}
                  to={`/settings/${id}`}
                >
                  <NativeSettingsIcon name={String(label)} fallback={<Icon size={15} />}/>
                  <span className="settings-nav-label" data-tooltip-label={String(label)}>{String(label)}</span>
                </Link>
              ))}
          </section>
        ))}
        {!search&&<section>
          <h4 hidden={guest}>Your teams</h4>
          {live(data.teams).filter(()=>!guest)
            .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
            .map((t) => (
              <Link
                className={section === `team-${t.id}` ? "active" : ""}
                to={`/settings/team-${t.id}`}
                key={t.id}
              >
                <EntityIcon entity={t} size={14} fallback="Layers"/>
                <span className="settings-nav-label" data-tooltip-label={t.name}>{t.name}</span>
              </Link>
            ))}
          {!guest&&<Link to="/settings/teams?new=1">Create a team</Link>}
        </section>}
        </div><div className="settings-sidebar-footer"><SidebarHelp onHelp={()=>{}} onShortcuts={()=>setShortcuts(true)}/></div>
        {shortcuts&&<ShortcutReference onClose={()=>setShortcuts(false)}/>}
      </aside>
      <main className={`feature-settings-main settings-section-${section}`}><div className={`feature-settings-content ${['labels','project-labels','initiative-labels','emojis','teams','members'].includes(section)?'settings-wide':''}`}>
        {section === "preferences" ? (
          <Preferences />
        ) : section === "profile" ? (
          <Profile />
        ) : section === "notifications" ? (
          <Notifications channel={subsection} />
        ) : section === "account-security" ? (
          <Security />
        ) : section === "connected-accounts" ? (
          <ConnectedAccounts />
        ) : section === "workspace" ? (
          <Workspace />
        ) : section === "teams" ? (
          <Teams />
        ) : section === "members" ? (
          <Members />
        ) : section === "security" ? (
          <WorkspaceSecurity />
        ) : section === "labels" || section === "project-labels" || section === "initiative-labels" ? (
          <Labels key={section} entityType={section==='project-labels'?'projects':section==='initiative-labels'?'initiatives':'issues'} />
        ) : section === "initiatives" || section === "documents" ? (<FeatureSettings kind={section}/>) : section === "templates" || section === "project-templates" || section === "document-templates" ? (
          <TemplatesSettings key={section} defaultKind={section==='project-templates'?'project':section==='document-templates'?'document':'issue'}/>
        ) : section === "project-updates" ? (<UpdateSettings kind="project"/>) : section === "initiative-updates" ? (<UpdateSettings kind="initiative"/>) : section === "project-statuses" ? (
          <ProjectStatusSettings />
        ) : section === "workflows" ? (
          <Navigate to="/settings/teams" replace />
        ) : section === "slas" ? (
          <Slas />
        ) : section === "integrations" ? (
          <Integrations providerSlug={subsection} />
        ) : section === "api" ||
          section === "webhooks" ||
          section === "applications" ? (
          <DeveloperSettings section={section} />
        ) : section === "mcp" ? (
          <Mcp />
        ) : section === "customers" ? (
          <CustomerRequestSettings />
        ) : section === "emojis" ? (
          <CustomEmojisSettings />
        ) : section === "asks" ? (
          <AsksSettings />
        ) : section.startsWith("team-") ? (
          <TeamSettings teamId={section.slice(5)} />
        ) : (
          <Blank
            title="Setting not found"
            action={<Link to="/settings/preferences">Preferences</Link>}
          />
        )}
      </div></main>
    </div>
  );
}
function SettingTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="feature-setting-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
function SettingSection({
  title,
  description,
  children,
  className = "",
  splitBeforeLast = false,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  splitBeforeLast?: boolean;
}) {
  const rows = React.Children.toArray(children);
  return (
    <section className={`feature-setting-section ${className}`.trim()}>
      <h3>{title}</h3>
      {description&&<p className="settings-section-description">{description}</p>}
      {splitBeforeLast ? <>
        <div className="feature-settings-card">{rows.slice(0, -1)}</div>
        <div className="feature-settings-card settings-secondary-card">{rows.slice(-1)}</div>
      </> : <div className="feature-settings-card">{children}</div>}
    </section>
  );
}
function SettingRow({
  title,
  description,
  icon,
  id,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="feature-settings-row" id={id}>
      {icon ? <div className="settings-row-leading">
        <span className="settings-row-leading-icon" aria-hidden="true">{icon}</span>
        <div className="settings-row-leading-copy"><strong>{title}</strong>{description && <p>{description}</p>}</div>
      </div> : <div><strong>{title}</strong>{description && <p>{description}</p>}</div>}
      {children}
    </div>
  );
}

function TeamOverviewRow({
  title,
  description,
  value,
  icon,
  onClick,
  href,
}: {
  title: string;
  description: string;
  value?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const content = <>
    <span className="team-overview-row-icon" aria-hidden="true">{icon}</span>
    <span className="team-overview-row-copy"><strong>{title}</strong><small>{description}</small></span>
    {value&&<span className="team-overview-row-value">{value}</span>}
    <ChevronRight className="team-overview-row-chevron" size={14}/>
  </>;
  return href
    ? <Link className="team-overview-row" aria-label={title} to={href}>{content}</Link>
    : <button type="button" className="team-overview-row" aria-label={title} onClick={onClick}>{content}</button>;
}
function NotificationRow({icon,title,description,onClick}:{icon:React.ReactNode;title:string;description:string;onClick:()=>void}){
 return <button type="button" className="settings-notification-row" onClick={onClick}><span className="settings-notification-icon">{icon}</span><span><strong>{title}</strong><small><i/> {description}</small></span><span className="settings-row-chevron">›</span></button>;
}
function Toggle({
  value,
  onChange,
  label,
  disabled=false,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?:boolean;
}) {
  return (
    <button
      role="switch"
      disabled={disabled}
      aria-checked={value}
      aria-label={label}
      className={`feature-toggle ${value ? "on" : ""}`}
      onClick={() => onChange(!value)}
    >
      <i />
    </button>
  );
}
function PreferenceSelect({
  value,
  values,
  onChange,
  label,
}: {
  value: any;
  values: string[] | { value: string; label: string }[];
  onChange: (v: string) => void;
  label: string;
}) {
  const selected = values.find(item => (typeof item === "string" ? item : item.value) === value);
  const selectedLabel = typeof selected === "string" ? selected : selected?.label || "";
  return (
    <span className="feature-preference-control">
    <span className="feature-preference-sizer" aria-hidden="true">{selectedLabel}</span>
    <select
      aria-label={label}
      className="feature-preference-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {values.map((v) =>
        typeof v === "string" ? (
          <option key={v} value={v}>
            {v}
          </option>
        ) : (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ),
      )}
    </select>
    <svg className="feature-preference-chevron" width="10" height="5" viewBox="0 0 9 5" fill="currentColor" aria-hidden="true"><path d="M1.915.557a.667.667 0 0 0-.943.943l2.862 2.862a.942.942 0 0 0 1.333 0L8.028 1.5a.667.667 0 0 0-.943-.943L4.5 3.143 1.915.557Z"/></svg>
    </span>
  );
}

function SettingsToolbarSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(Math.max(0, options.indexOf(value)));
  const root = useRef<HTMLDivElement>(null);
  const listId = React.useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const choose = (next: string) => {
    onChange(next);
    setActive(options.indexOf(next));
    setOpen(false);
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[role="combobox"]')?.focus());
  };
  const keyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(options[active]); else setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setOpen(true);
      setActive(index => (index + direction + options.length) % options.length);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setOpen(true);
      setActive(event.key === 'Home' ? 0 : options.length - 1);
    }
  };
  return <div className="settings-toolbar-select" ref={root} onKeyDown={keyDown}>
    <button type="button" role="combobox" aria-label={label} aria-controls={listId} aria-haspopup="listbox" aria-expanded={open} aria-activedescendant={open ? `${listId}-${active}` : undefined} onClick={() => { setActive(Math.max(0, options.indexOf(value))); setOpen(current => !current); }}>
      <span>{value}</span><ChevronDown size={14} aria-hidden="true"/>
    </button>
    {open && <div className="settings-toolbar-select-menu" id={listId} role="listbox" aria-label={label} style={{top: -4 - Math.max(0, options.indexOf(value)) * 32}}>
      {options.map((option, index) => <button type="button" id={`${listId}-${index}`} role="option" aria-selected={option === value} className={index === active ? 'active' : ''} key={option} onPointerMove={() => setActive(index)} onClick={() => choose(option)}><span>{option}</span>{option === value && <Check size={14} aria-hidden="true"/>}</button>)}
    </div>}
  </div>;
}
function Preferences() {
  const { data, user, update, act } = useActions();
  const preferenceLocation=useLocation();
  const [customThemeOpen,setCustomThemeOpen]=useState(false);
  const current = data.users.find((u) => u.id === user?.id) || user;
  const p = current?.preferences || {};
  const localFontSize = useLocalFontSize(p.fontSize,!!current);
  const patch = (key: string, value: any) =>
    current &&
    act(() =>
      update("users", current.id, { preferences: { ...p, [key]: value } }),
    );
  useEffect(()=>{const target=new URLSearchParams(preferenceLocation.search).get('focus');if(!target)return;requestAnimationFrame(()=>document.querySelector<HTMLElement>(target==='theme'?'[aria-label="Interface theme"]':target==='default-view'?'[aria-label="Default home view"]':'')?.focus());},[preferenceLocation.search]);
  return (
    <>
      <SettingTitle title="Preferences" />
      <SettingSection title="General">
        <SettingRow
          title="Default home view"
          description="Select which view to display when launching Parabolic"
        >
          <PreferenceSelect
            label="Default home view"
            value={p.homeView || "/my-issues"}
            values={[
              { value: "/inbox", label: "Inbox" },
              { value: "/my-issues", label: "My issues" },
              { value: "/all", label: "All issues" },
              { value: "/issues/active", label: "Active issues" },
              { value: "/cycles", label: "Current cycle" },
              { value: "/projects", label: "Projects" },
              { value: "/initiatives", label: "Initiatives" },
            ]}
            onChange={(v) => patch("homeView", v)}
          />
        </SettingRow>
        <SettingRow
          title="Display names"
          description="Select how names are displayed in the Parabolic interface"
        >
          <PreferenceSelect
            label="Display names"
            value={p.displayNames === "Username" ? "Username" : "Full name"}
            values={["Full name", "Username"]}
            onChange={(v) => patch("displayNames", v)}
          />
        </SettingRow>
        <SettingRow
          title="First day of the week"
          description="Used for date pickers"
        >
          <PreferenceSelect
            label="First day of week"
            value={p.weekStartsOn || "Monday"}
            values={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]}
            onChange={(v) => patch("weekStartsOn", v)}
          />
        </SettingRow>
        <SettingRow title="Convert text emoticons into emojis" description="Strings like :) will be converted to 🙂"><Toggle label="Convert text emoticons into emojis" value={p.convertEmoticons!==false} onChange={v=>patch("convertEmoticons",v)}/></SettingRow>
        <SettingRow
          title="Send comments on…"
          description="Choose which key press is used to submit comments"
        >
          <PreferenceSelect
            label="Submit comments with"
            value={p.commentSubmit || "Enter"}
            values={[{value:"Command + Enter",label:"⌘+Enter"},{value:"Enter",label:"Enter"}]}
            onChange={(v) => patch("commentSubmit", v)}
          />
        </SettingRow>
      </SettingSection>
      <SettingSection title="Interface and theme" className="preferences-interface-section" splitBeforeLast><SettingRow title="App sidebar" description="Customize sidebar item visibility, ordering, and badge style"><SidebarCustomizationButton/></SettingRow>
        <SettingRow
          title="Font size"
          description="Adjust the size of text across the app"
        >
          <PreferenceSelect
            label="Font size"
            value={localFontSize}
            values={FONT_SIZE_OPTIONS}
            onChange={setLocalFontSize}
          />
        </SettingRow>
        <SettingRow
          title="Use pointer cursors"
          description="Change the cursor to a pointer when hovering over any interactive elements"
        >
          <Toggle
            label="Use pointer cursors"
            value={p.pointerCursor !== false}
            onChange={(v) => patch("pointerCursor", v)}
          />
        </SettingRow>
        <SettingRow
          title="Underline links"
          description="Always underline links in text content"
        >
          <Toggle
            label="Underline links"
            value={!!p.underlineLinks}
            onChange={(v) => patch("underlineLinks", v)}
          />
        </SettingRow>
        <SettingRow
          title="Disable animated images & emoji"
          description="When enabled, GIFs and animated emojis will be static by default and animate only on hover."
        >
          <Toggle label="Disable animated images and emoji" value={!!p.reduceAnimatedImages} onChange={(v) => patch("reduceAnimatedImages", v)} />
        </SettingRow>
        <SettingRow title="Interface theme" description="Select or customize your interface color scheme">
          <span className="settings-theme-control"><span aria-hidden="true">Aa</span><PreferenceSelect label="Interface theme" value={p.theme||'dark'} values={[{value:'system',label:'System preference'},{value:'light',label:'Light'},{value:'pure-light',label:'Pure Light'},{value:'dark',label:'Dark'},{value:'magic-blue',label:'Magic Blue'},{value:'classic-dark',label:'Classic Dark'},{value:'custom',label:'Custom'}]} onChange={value=>{if(value==='custom')setCustomThemeOpen(true);else patch('theme',value)}}/></span>
        </SettingRow>
      </SettingSection>
      <SettingSection title="Desktop application" className="preferences-desktop-section"><SettingRow title="Open in desktop app" description="Automatically open links in desktop app when possible">{window.desktop?.isDesktop?<Action onClick={()=>window.open(location.origin+'/settings/preferences','_blank','noopener,noreferrer')}>Manage on Web</Action>:<Toggle label="Open in desktop app" value={!!p.openDesktop} onChange={v=>patch("openDesktop",v)}/>}</SettingRow><SettingRow title="App notification badge" description="Show a badge on Parabolic’s icon to indicate unread notifications"><PreferenceSelect label="App notification badge" value={desktopBadgeMode(p)} values={[{value:"off",label:"Off"},{value:"indicator",label:"Unread indicator"},{value:"count",label:"Unread count"}]} onChange={v=>patch("notificationBadgeMode",v)}/></SettingRow><SettingRow title="Check spelling" description="Check for spelling errors while typing"><Toggle label="Check spelling" value={p.spellcheck!==false} onChange={v=>patch("spellcheck",v)}/></SettingRow><SettingRow title="Auto-close stale tabs" description="Pinned tabs and tabs with unsaved work stay open"><PreferenceSelect label="Auto-close stale tabs" value={p.desktopTabCleanupInterval||"never"} values={[{value:"never",label:"Never"},{value:"sixHours",label:"6 hours"},{value:"twelveHours",label:"12 hours"},{value:"twentyFourHours",label:"24 hours"},{value:"threeDays",label:"3 days"},{value:"sevenDays",label:"7 days"}]} onChange={value=>patch("desktopTabCleanupInterval",value)}/></SettingRow></SettingSection>
      <SettingSection title="Automations and workflows"><SettingRow title="Auto-assign to self" description="When creating new issues, always assign them to yourself by default"><Toggle label="Auto-assign to self" value={!!p.autoAssign} onChange={v=>patch("autoAssign",v)}/></SettingRow><SettingRow title="On move to started status, assign to yourself" description="When you move an unassigned issue to started, it will be automatically assigned to you"><Toggle label="On move to started status, assign to yourself" value={!!p.autoAssignStarted} onChange={v=>patch("autoAssignStarted",v)}/></SettingRow></SettingSection>
      {customThemeOpen&&<FormDialog title="Custom theme" fields={[]} submit="Done" onClose={()=>setCustomThemeOpen(false)} onSave={async()=>true}><CustomThemeControls preferences={p} onChange={theme=>{if(current)void act(()=>update('users',current.id,{preferences:{...p,customTheme:theme,theme:'custom'}}))}}/></FormDialog>}
    </>
  );
}
function Profile() {
  const { data, user, update, act, pending, reload, logout } = useActions();
  const [leaving,setLeaving]=useState(false);
  const navigate=useNavigate();
  const workspace=data.workspaces.find(w=>w.id===data.workspaceId);
  const membership=data.memberships.find(m=>m.userId===user?.id&&!m.teamId&&!m.deletedAt);
  const lastOwner=membership?.role==='owner'&&!data.memberships.some(m=>m.userId!==user?.id&&!m.teamId&&!m.deletedAt&&['owner','admin'].includes(m.role));
  const current = data.users.find((u) => u.id === user?.id) || user;
  const [name, setName] = useState(current?.name || ""),
    [title, setTitle] = useState(current?.title || ""),[username,setUsername]=useState(current?.username||"");
  const save=(values:Record<string,any>)=>current&&act(()=>update("users",current.id,values),"Profile updated");
  if (!current) return null;
  return (
    <>
      <SettingTitle title="Profile" />
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="feature-settings-card settings-profile-card">
          <SettingRow title="Profile picture"><ProfileAvatar user={current} compact/></SettingRow>
          <SettingRow title="Email"><ProfileEmail email={current.email}/></SettingRow>
          <SettingRow title="Full name">
            <input
              required
              className="input"
              aria-label="Full name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={()=>name.trim()&&save({name:name.trim()})}
            />
          </SettingRow>
          <SettingRow title="Title" description="Your job title or role"><input className="input" aria-label="Title" value={title} onChange={e=>setTitle(e.target.value)} onBlur={()=>save({title:title.trim()})} placeholder="Software engineer"/></SettingRow>
          <SettingRow title="Username" description="One word, like a nickname or first name"><input className="input" aria-label="Username" maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._\-]*" value={username} onChange={e=>setUsername(e.target.value)} onBlur={()=>save({username:username.trim()})} placeholder="username"/></SettingRow>
        </div>
      </form>
      <SettingSection title="Workspace access">
        <SettingRow title="Remove yourself from workspace">
          <Action className="settings-danger-action" disabled={lastOwner||pending>0} onClick={()=>setLeaving(true)}>Leave workspace</Action>
        </SettingRow>
        {pending>0&&<p className="muted">Wait for your changes to finish saving before leaving.</p>}
      </SettingSection>
      {leaving&&<FormDialog title={`Leave ${workspace?.name||'workspace'}?`} fields={[]} submit="Leave workspace" onClose={()=>setLeaving(false)} onSave={async()=>{
        if(pending>0)throw new Error('Wait for your changes to finish saving before leaving.');
        const result=await apiRequest('/auth/workspace/leave',{method:'POST',body:JSON.stringify({workspaceId:data.workspaceId})});
        if(result.workspaceId)await reload();else await logout();
        navigate('/my-issues',{replace:true});
        return result;
      }}><p className="muted">You will lose access to this workspace. An administrator must restore your access before you can return. Your issues and comments remain in the workspace.</p></FormDialog>}
    </>
  );
}
const notificationTypes=[
  ['assignments','Assignments','Assignments, unassignments, and membership changes'],
  ['status','Status changes','Changes to the status, priority, and blocking relationships of issues'],
  ['comments','Comments and replies','Comments, replies, and thread resolutions'],
  ['mentions','Mentions','Mentions in comments or content'],
  ['reactions','Reactions','Emoji reactions to your content'],
  ['subscriptions','Subscriptions',"Issues, projects, initiatives, teams, and views you're subscribed to"],
  ['documents','Document changes','Changes to document content, location, and subscriptions'],
  ['updates','Updates','New project & initiative updates and reminders to post an update'],
  ['deadlines','Reminders and deadlines','Reminders, due dates, and SLA updates'],
  ['apps','Apps and integrations','Requests related to OAuth apps and integrations'],
  ['requests','Customer requests','Requests from your customers'],
  ['triage','Triage','Issues added to triage'],
] as const;
function Notifications({channel}:{channel?:string}) {
  const {data,user,act}=useActions(),navigate=useNavigate();
  const current=data.users.find(item=>item.id===user?.id)||user,p=current?.preferences||{},n=p.notifications||{};
  const [testMessage,setTestMessage]=useState('');
  const [permission,setPermission]=useState(()=>window.desktop?.isDesktop?'granted':'Notification' in window?Notification.permission:'unsupported');
  const patch=(key:string,value:any)=>current&&act(()=>patchUserPreferences(current.id,{notifications:{[key]:value}}));
  const patchMany=(values:Record<string,any>)=>current&&act(()=>patchUserPreferences(current.id,{notifications:values}));
  const desktopEnabled=n.desktop!==false&&permission==='granted';
  const channelTypes=(name:string)=>name==='desktop'?n:n[`${name}Types`]||{};
  const desktopKeys:Record<string,string>={assignments:'assigned',mentions:'mentioned',documents:'documentChanges',updates:'projectUpdates',deadlines:'reminders'};
  const patchType=(name:string,key:string,value:boolean)=>{
    if(name!=='desktop'){patch(`${name}Types`,{[key]:value});return;}
    if(key==='deadlines'){patchMany({reminders:value,sla:value,dueDateAlerts:value,teamSla:value});return;}
    if(key==='updates'){patchMany({projectUpdates:value,initiativeUpdates:value,updateReminders:value});return;}
    patch(desktopKeys[key]||key,value);
  };
  if(channel&&['desktop','mobile','email','slack'].includes(channel)){
    const title=channel[0].toUpperCase()+channel.slice(1),types=channelTypes(channel),enabled=channel==='desktop'?desktopEnabled:n[channel]!==false;
    const typeValue=(key:string)=>channel==='desktop'?(key==='reactions'?n.reactions===true:key==='deadlines'?[n.reminders,n.sla,n.dueDateAlerts,n.teamSla].every(value=>value!==false):key==='updates'?[n.projectUpdates,n.initiativeUpdates,n.updateReminders].every(value=>value!==false):n[desktopKeys[key]||key]!==false):types[key]!==false;
    const setEnabled=async(value:boolean)=>{
      if(channel!=='desktop'){patch(channel,value);return;}
      if(!value){patch('desktop',false);return;}
      if(window.desktop?.isDesktop){patch('desktop',true);return;}
      if(!('Notification' in window))return;
      const next=await Notification.requestPermission();setPermission(next);patch('desktop',next==='granted');
    };
    return <div className="notification-channel-settings">
      <Link className="notification-channel-back" to="/settings/notifications">‹ <span>Notifications</span></Link>
      <SettingTitle title={title} description={channel==='desktop'?'Applies across all your desktop devices with notifications enabled':undefined}/>
      {channel==='slack'?<div className="feature-settings-card notification-channel-primary"><SettingRow title="Personal Slack account not connected"><Link className="settings-priority-link" to="/settings/connected-accounts">Connected accounts <span>›</span></Link></SettingRow></div>:<div className="feature-settings-card notification-channel-primary">
        <SettingRow title={`Enable ${channel} notifications`} description={channel==='email'?`Email notifications to ${current?.email||''}`:`Parabolic ${channel==='mobile'?'mobile app':'Desktop'} push notifications`}><Toggle label={`Enable ${channel} notifications`} disabled={channel==='desktop'&&permission==='unsupported'} value={enabled} onChange={value=>void setEnabled(value)}/></SettingRow>
        <SettingRow title="Only deliver priority notifications" description="Uses your priority notification settings →"><Toggle label="Only deliver priority notifications" disabled={!enabled} value={!!n[channel==='desktop'?'priorityOnly':`${channel}PriorityOnly`]} onChange={value=>patch(channel==='desktop'?'priorityOnly':`${channel}PriorityOnly`,value)}/></SettingRow>
        {channel==='desktop'&&<SettingRow title="Test notifications"><Action className="notification-test-action" disabled={!desktopEnabled} onClick={async()=>{try{if(window.desktop?.isDesktop){const sent=await window.desktop.notify({title:'Parabolic',body:'Desktop notifications are working.',route:'/inbox',tag:'notification-test:'+Date.now()});setTestMessage(sent?'Test notification requested.':'Desktop notifications are unavailable.');}else if(Notification.permission==='granted'){new Notification('Parabolic',{body:'Desktop notifications are working.'});setTestMessage('Test notification requested.');}}catch{setTestMessage('Unable to request a test notification.');}}}>Send test notification</Action></SettingRow>}
        {channel==='email'&&<SettingRow title="Notification format" description="Choose whether to group email notifications"><PreferenceSelect label="Notification format" value={n.emailFormat==='immediate'?'Immediate':'Digest'} values={['Digest','Immediate']} onChange={value=>patch('emailFormat',value.toLowerCase())}/></SettingRow>}
      </div>}
      {testMessage&&<p className="notification-test-status" role="status">{testMessage}</p>}
      {channel==='mobile'&&<SettingSection title="Schedule" description="Choose when mobile notifications are delivered"><div className="feature-settings-card notification-schedule-card"><SettingRow title="Only deliver notifications during scheduled and in-office hours" description="Restrict mobile notification delivery to the configured schedule"><Toggle label="Schedule mobile notifications" value={!!n.mobileScheduled} onChange={value=>patch('mobileScheduled',value)}/></SettingRow><div className="notification-schedule-controls"><div><span>Days</span><div className="notification-day-picker">{'MTWTFSS'.split('').map((day,index)=><button type="button" className={(n.mobileScheduleDays||[1,2,3,4,5]).includes(index+1)?'active':''} aria-label={`Schedule day ${index+1}`} key={index} onClick={()=>{const selected=n.mobileScheduleDays||[1,2,3,4,5],next=selected.includes(index+1)?selected.filter((item:number)=>item!==index+1):[...selected,index+1].sort();patch('mobileScheduleDays',next)}}>{day}</button>)}</div></div><label><span>From</span><input className="input notification-time" aria-label="Mobile schedule from" type="time" value={n.mobileScheduleFrom||'08:00'} onChange={event=>patch('mobileScheduleFrom',event.target.value)}/></label><label><span>To</span><input className="input notification-time" aria-label="Mobile schedule to" type="time" value={n.mobileScheduleTo||'18:00'} onChange={event=>patch('mobileScheduleTo',event.target.value)}/></label></div></div></SettingSection>}
      {channel==='email'&&n.emailFormat!=='immediate'&&<SettingSection title="Email digest settings"><SettingRow title="Delay low priority emails outside of work hours until next work day" description="Delay low priority emails outside of work hours until the next work day"><Toggle label="Delay low priority emails outside of work hours until next work day" value={n.emailDelayOutsideWorkHours!==false} onChange={value=>patch('emailDelayOutsideWorkHours',value)}/></SettingRow><SettingRow title="Immediately notify if an assigned issue is urgent or breaches SLA" description="Immediately notify when an assigned issue is urgent or breaches its SLA"><Toggle label="Immediately notify if an assigned issue is urgent or breaches SLA" value={n.emailUrgentImmediate!==false} onChange={value=>patch('emailUrgentImmediate',value)}/></SettingRow></SettingSection>}
      <SettingSection title="General notifications">{notificationTypes.map(([key,label,description])=><SettingRow key={key} title={label} description={description}><Toggle label={`${label} via ${title}`} disabled={channel==='slack'||!enabled} value={typeValue(key)} onChange={value=>patchType(channel,key,value)}/></SettingRow>)}</SettingSection>
    </div>;
  }
  return <>
    <SettingTitle title="Notifications" />
    <SettingSection title="Inbox" description="Manage how notifications are organized in your inbox">
      <SettingRow title="Priority inbox" description="Separate important notifications from the rest of your inbox"><Toggle label="Priority inbox" value={p.inbox?.priorityEnabled!==false} onChange={value=>current&&act(()=>patchUserPreferences(current.id,{inbox:{priorityEnabled:value}}))}/></SettingRow>
      <SettingRow title="Priority notifications" description="Choose which notifications are treated as priority"><Link className="settings-priority-link" to="/inbox?settings=priority">11 types <span>›</span></Link></SettingRow>
    </SettingSection>
    <SettingSection title="Push notifications" description="Choose which notifications are pushed to your devices. All notifications will still appear in your inbox.">
      <NotificationRow icon={<Monitor size={15}/>} title="Desktop" description={desktopEnabled?'Enabled for assignments, status changes, 12 others':'Disabled'} onClick={()=>navigate('/settings/notifications/desktop')}/>
      <NotificationRow icon={<Smartphone size={15}/>} title="Mobile" description={n.mobile===false?'Disabled':'Enabled for all notifications'} onClick={()=>navigate('/settings/notifications/mobile')}/>
      <NotificationRow icon={<Mail size={15}/>} title="Email" description={n.email===false?'Disabled':'Enabled for all notifications'} onClick={()=>navigate('/settings/notifications/email')}/>
      <NotificationRow icon={<MessageSquare size={15}/>} title="Slack" description="Disabled" onClick={()=>navigate('/settings/notifications/slack')}/>
    </SettingSection>
    <SettingSection className="notification-updates-section" title="Updates from Parabolic" description="Subscribe to product announcements and important changes from the Parabolic team">
      <div className="settings-notification-group"><h4>Other updates</h4><div className="feature-settings-card"><SettingRow title="Invite accepted" description="Email when invitees accept an invite"><Toggle label="Invite accepted" value={n.inviteAccepted!==false} onChange={value=>patch('inviteAccepted',value)}/></SettingRow></div></div>
    </SettingSection>
  </>;
}
function FeatureSettings({kind}:{kind:'initiatives'|'documents'}){
 const {data,user,update,act}=useActions(),navigate=useNavigate(),workspace=data.workspaces.find(w=>w.id===data.workspaceId),admin=data.memberships.some(m=>!m.deletedAt&&!m.teamId&&m.userId===user?.id&&['owner','admin'].includes(m.role));
 if(kind==='initiatives')return <div className="initiative-settings-page"><SettingTitle title="Initiatives" description={<>Initiatives group multiple projects that contribute toward the same strategic effort. Use initiatives to plan and coordinate larger streams of work and monitor their progress at scale. <a href="https://parabolic.app/docs/initiatives" target="_blank" rel="noreferrer">Docs ↗</a></>}/>{workspace&&<div className="feature-settings-card initiative-enable-card"><SettingRow title="Enable Initiatives" description="Visible to all non-guest workspace members"><Toggle label="Enable initiatives" disabled={!admin} value={workspace.initiativesEnabled!==false} onChange={value=>act(()=>update('workspaces',workspace.id,{initiativesEnabled:value}))}/></SettingRow></div>}<UpdateSettings kind="initiative" embedded/><SettingSection title="Labels"><SettingRow icon={<Tag size={15}/>} title="Initiative labels" description="Manage the labels that can be applied to initiatives in your workspace"><span className="initiative-label-action"><span>{data.labels.filter(label=>!label.deletedAt&&label.entityType==='initiatives').length} labels</span><Link aria-label="Manage initiative labels" to="/settings/initiative-labels">›</Link></span></SettingRow></SettingSection></div>;
 const documentTemplates=live(data.templates).filter(template=>template.type==='document');
 return <div className="document-settings-page"><SettingTitle title="Documents"/><SettingSection title="Templates" description={<>These templates are available when creating documents for any team in the workspace. To create templates that only apply to specific teams, add them as team templates. <a href="https://parabolic.app/docs/documents" target="_blank" rel="noreferrer">Docs ↗</a></>}>
   {!documentTemplates.length?<div className="feature-settings-row document-template-empty"><h3>No document templates</h3><Button aria-label="Create new document template" onClick={()=>navigate('/settings/document-templates?new=document&return=documents')}><Plus size={14}/>New template</Button></div>:<>{documentTemplates.map(template=><div className="feature-settings-row document-template-row" key={template.id}><FileText size={15}/><div><strong>{template.name}</strong><p>{data.teams.find(team=>team.id===template.teamId)?.name||'Workspace'}</p></div><Link className="button" to={`/settings/document-templates?template=${template.id}&return=documents`}>Edit</Link><EntityMenu kind="templates" item={template}/></div>)}<div className="feature-settings-row document-template-add"><span/><Button aria-label="Create new document template" onClick={()=>navigate('/settings/document-templates?new=document&return=documents')}><Plus size={14}/>New template</Button></div></>}
 </SettingSection></div>;
}

function Workspace() {
  const { data, update, act } = useActions();
  const workspace = data.workspaces.find((w) => w.id === data.workspaceId);
  const [name,setName]=useState(workspace?.name||""),[urlKey,setUrlKey]=useState(workspace?.urlKey||"");
  useEffect(()=>{setName(workspace?.name||"");setUrlKey(workspace?.urlKey||"")},[workspace?.id,workspace?.name,workspace?.urlKey]);
  if (!workspace) return null;
  const save=(key:"name"|"urlKey",value:string)=>{const trimmed=value.trim();if(trimmed&&trimmed!==workspace[key])act(()=>update("workspaces",workspace.id,{[key]:trimmed}))};
  const uploadLogo=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>act(()=>update("workspaces",workspace.id,{logoUrl:String(reader.result)}));reader.readAsDataURL(file)};
  return (
    <div className="workspace-settings-page">
      <SettingTitle title="Workspace" />
      <div className="feature-settings-card workspace-general-card">
        <SettingRow title="Logo" description="Recommended size is 256x256px"><label className="settings-workspace-logo"><input aria-label="Logo" type="file" accept="image/*" onChange={event=>uploadLogo(event.target.files?.[0])}/>{workspace.logoUrl?<img src={workspace.logoUrl} alt=""/>:<span className="workspace-logo-mark"><i/><i/><i/></span>}</label></SettingRow>
        <SettingRow title="Name">
          <input className="workspace-inline-input" placeholder={workspace.name} value={name} onChange={event=>setName(event.target.value)} onBlur={()=>save("name",name)} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/>
        </SettingRow>
        <SettingRow title="URL">
          <label className="workspace-url-input"><span>parabolic.app/</span><input value={urlKey} onChange={event=>setUrlKey(event.target.value)} onBlur={()=>save("urlKey",urlKey)} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/></label>
        </SettingRow>
      </div>
      <SettingSection title="Time & region">
        <SettingRow title="First month of the fiscal year" description="Used when grouping projects and issues quarterly, half-yearly, and yearly">
          <PreferenceSelect
            label="Fiscal year start"
            value={workspace.fiscalYearStart || "January"}
            values={[
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ]}
            onChange={(v) =>
              act(() =>
                update("workspaces", workspace.id, { fiscalYearStart: v }),
              )
            }
          />
        </SettingRow>
        <SettingRow title="Region" description="Set when a workspace is created and cannot be changed. Read more"><span className="muted">{workspace.region || "United States"}</span></SettingRow>
      </SettingSection>
      <SettingSection title="Danger zone"><WorkspaceDeletion/></SettingSection>
    </div>
  );
}
function Teams() {
  const { data, create, act, reload } = useActions();
  const [lifecycleTab,setLifecycleTab]=useState("Active"),[query,setQuery]=useState(""),[sortField,setSortField]=useState<'name'|'visibility'|'members'|'issues'|'created'>('name'),[sortAscending,setSortAscending]=useState(true);
  const [add, setAdd] = useState(new URLSearchParams(window.location.search).get('new')==='1');
  const [teamMenu,setTeamMenu]=useState<string|null>(null),[teamSettingsMenu,setTeamSettingsMenu]=useState(false),[settingsQuery,setSettingsQuery]=useState(''),[deleteTarget,setDeleteTarget]=useState<any>(null);
  const nav = useNavigate();
  const teamMembers=(team:any)=>data.memberships.filter(m=>m.teamId===team.id&&!m.deletedAt).length;
  const teamIssues=(team:any)=>data.issues.filter(i=>i.teamId===team.id&&!i.deletedAt).length;
  const teamVisibility=(team:any)=>team.visibility==='restricted'?'Restricted':team.private?'Private':'Workspace';
  const teamSettingsOptions=[['Overview',''],['General','General'],['Security','General'],['Members','Members'],['Issue labels','Issue labels'],['Templates','Templates'],['Recurring issues','Recurring issues'],['Slack notifications','/settings/integrations'],['Issue statuses','Workflow'],['Workflows & automations','Workflow'],['Triage','Triage'],['Cycles','Cycles'],['Project updates','/settings/project-updates'],['Resolved thread summaries','Workflow']];
  const order=(field:typeof sortField)=>{if(sortField===field)setSortAscending(value=>!value);else{setSortField(field);setSortAscending(true)}};
  const orderedTeams=data.teams.filter(t=>(!query||t.name.toLowerCase().includes(query.toLowerCase()))&&(lifecycleTab==="Recently deleted"?t.deletedAt&&!t.permanentlyDeleted:lifecycleTab==="Retired"?!t.deletedAt&&(t.retiredAt||t.archivedAt):!t.deletedAt&&!t.archivedAt&&!t.retiredAt)).sort((a,b)=>{const av=sortField==='members'?teamMembers(a):sortField==='issues'?teamIssues(a):sortField==='visibility'?teamVisibility(a):sortField==='created'?a.createdAt||'':a.name,bv=sortField==='members'?teamMembers(b):sortField==='issues'?teamIssues(b):sortField==='visibility'?teamVisibility(b):sortField==='created'?b.createdAt||'':b.name;return(sortAscending?1:-1)*(typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv)))});
  return (
    <div className="teams-settings-page settings-wide">
      <SettingTitle title="Teams" />
      <div className="teams-toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Filter by name…"/><SettingsToolbarSelect label="Team status" value={lifecycleTab} options={['Active','Retired','Recently deleted']} onChange={setLifecycleTab}/><div/><Action onClick={()=>downloadCsv('teams.csv',['Name,Visibility,Members,Issues,Created',...data.teams.map(t=>[t.name,t.visibility||'Workspace',data.memberships.filter(m=>m.teamId===t.id).length,data.issues.filter(i=>i.teamId===t.id&&!i.deletedAt).length,t.createdAt||''].join(','))].join('\n'))}>Export CSV</Action><Action aria-label="Create new team" primary onClick={() => setAdd(true)}>Create team</Action></div>
      <div className="teams-table">
        <div className="teams-table-head">{([['name','Name'],['visibility','Visibility'],['members','Members'],['issues','Issues'],['created','Created']] as const).map(([field,label])=><button type="button" aria-label={`Order by ${label}`} key={field} onClick={()=>order(field)}>{label}{sortField===field?` ${sortAscending?'↓':'↑'}`:''}</button>)}<span/></div>
        <div className="teams-table-group">{lifecycleTab} <span>{data.teams.filter(t=>lifecycleTab==="Recently deleted"?t.deletedAt&&!t.permanentlyDeleted:lifecycleTab==="Retired"?!t.deletedAt&&(t.retiredAt||t.archivedAt):!t.deletedAt&&!t.archivedAt&&!t.retiredAt).length}</span></div>
        {orderedTeams.map((t) => (
          <div className="teams-table-row" key={t.id}>
            <Link to={`/settings/team-${t.id}`} className="feature-name">
              <EntityIcon entity={t} size={16} fallback="Layers"/>
              <strong>{t.name}</strong><small>{t.key||t.identifier}</small>
            </Link>
            <span className="muted">{teamVisibility(t)}{t.parentId && <small> · {data.teams.find(parent=>parent.id===t.parentId)?.name}</small>}</span>
            <span className="muted">{teamMembers(t)}</span>
            <span className="muted">{teamIssues(t)}</span>
            <span className="muted">{t.createdAt?date(t.createdAt):'—'}</span>
            <div className="team-row-menu-anchor"><button type="button" className="feature-icon-button teams-row-menu" aria-label="Open menu" onClick={()=>{setTeamMenu(teamMenu===t.id?null:t.id);setTeamSettingsMenu(false);setSettingsQuery('')}}><MoreHorizontal size={16}/></button>{teamMenu===t.id&&<div className="team-row-menu-popover" role="listbox" aria-label={`${t.name} actions`} onMouseLeave={()=>setTeamSettingsMenu(false)}><button type="button" role="option" aria-selected="false" onMouseEnter={()=>setTeamSettingsMenu(true)} onClick={()=>setTeamSettingsMenu(true)}><Settings size={14}/><span>Settings</span><ChevronRight size={13}/></button><button type="button" role="option" aria-selected="false" onClick={()=>void act(async()=>{await apiRequest(`/api/v1/teams/${t.id}/leave`,{method:'POST'});setTeamMenu(null);return true})}><LogOut size={14}/><span>Leave team…</span></button><button type="button" role="option" aria-selected="false" onClick={()=>{setDeleteTarget(t);setTeamMenu(null)}}><Trash2 size={14}/><span>Delete…</span></button>{teamSettingsMenu&&<div className="team-row-settings-submenu" role="listbox" aria-label={`${t.name} settings`} onMouseEnter={()=>setTeamSettingsMenu(true)}><input aria-label="Filter settings" placeholder="Filter…" value={settingsQuery} onChange={event=>setSettingsQuery(event.target.value)}/>{teamSettingsOptions.filter(([label])=>label.toLowerCase().includes(settingsQuery.toLowerCase())).map(([label,destination])=><Link role="option" aria-selected="false" key={label} to={destination.startsWith('/')?destination:`/settings/team-${t.id}${destination?`?section=${encodeURIComponent(destination)}`:''}`}>{label}</Link>)}</div>}</div>}</div>
          </div>
        ))}
      </div>
      {add && (
        <FormDialog
          title="Create team"
          fields={[
            { key: "name", label: "Name", required: true },
            {
              key: "key",
              label: "Identifier",
              required: true,
              placeholder: "ENG",
            },
            { key: "description", label: "Description", type: "textarea" },
            {key:'parentId',label:'Parent team',type:'select',options:optionList(data.teams,'No parent team')},
            {key:'visibility',label:'Team visibility',type:'select',options:[{value:'',label:'Automatic (restricted under a private parent)'},{value:'public',label:'Public'},{value:'private',label:'Private'},{value:'restricted',label:'Restricted to parent members'}]},
          ]}
          onClose={() => setAdd(false)}
          onSave={async (v) => {
            const key = String(v.key || "").toUpperCase();
            if (!/^[A-Z][A-Z0-9]{0,9}$/.test(key))
              throw Error(
                "Use 1–10 uppercase letters or numbers, beginning with a letter.",
              );
            const t = await act(() =>
              create("teams", { ...v, ...(v.visibility?{}:{visibility:undefined}),parentId:v.parentId||null, key, identifier: key, color: "#7775df" }),
            );
            if (t) {
              nav(`/settings/team-${t.id}`);
            }
            return t;
          }}
        />
      )}
      {deleteTarget&&<FormDialog title="Delete team" fields={[{key:'name',label:'Team name',required:true}]} submit="Delete team" onClose={()=>setDeleteTarget(null)} onSave={async values=>{const preview=await apiRequest(`/api/v1/teams/${deleteTarget.id}/lifecycle`);await apiRequest(`/api/v1/teams/${deleteTarget.id}/lifecycle`,{method:'POST',body:JSON.stringify({action:'delete',name:values.name,version:preview.team.version,issues:'cancel'})});await reload();return true}}><p>Type <strong>{deleteTarget.name}</strong> to delete this team and its issues. You can restore them from Recently deleted teams within 30 days.</p></FormDialog>}
    </div>
  );
}
function TeamSettings({ teamId }: { teamId: string }) {
  const { data, user, update, create, act, reload } = useActions();
  const navigate = useNavigate();
  const team = data.teams.find((t) => t.id === teamId);
  const sectionLocation=useLocation();
  const [tab, setTab] = useState(new URLSearchParams(sectionLocation.search).get("section")||"Overview"),
    [edit, setEdit] = useState(false),[pendingParent,setPendingParent]=useState<string|null|undefined>(undefined);
  const teamTabs=["General","Cycles","Triage","Members","Workflow","Templates","Recurring issues","Issue labels"];
  useEffect(()=>{const requested=new URLSearchParams(sectionLocation.search).get("section");setTab(requested&&teamTabs.includes(requested)?requested:"Overview")},[sectionLocation.key]);
  if (!team) return <Blank title="Team not found" />;
  if(team.deletedAt||team.retiredAt||team.archivedAt)return <><SettingTitle title={team.name} description="Team history is preserved."/><TeamLifecycleControls team={team}/></>;
  const parent=data.teams.find(t=>t.id===team.parentId),cycleParent=data.teams.find(t=>t.id===team.inheritedCycleTeamId);
  const descendant=(candidate:Row)=>{const seen=new Set<string>();let current:Row|undefined=candidate;while(current?.parentId&&!seen.has(current.id)){if(current.parentId===team.id)return true;seen.add(current.id);current=data.teams.find(t=>t.id===current!.parentId)}return false};
  const patch = (v: Record<string, any>) =>
    act(() => update("teams", team.id, v));
  const openTab=(next:string)=>navigate(`/settings/team-${team.id}${next==='Overview'?'':`?section=${encodeURIComponent(next)}`}`);
  const memberIds=new Set([
    ...live(data.memberships).filter(m=>m.teamId===team.id).map(m=>m.userId),
    ...(team.memberIds||[]),
    ...(team.ownerIds||(team.ownerId||team.creatorId?[team.ownerId||team.creatorId]:[])),
  ].filter(Boolean));
  const labelCount=live(data.labels).filter(label=>(label.entityType||'issues')==='issues'&&label.teamId===team.id).length+live(data.labelGroups).filter(group=>(group.entityType||'issues')==='issues'&&group.teamId===team.id).length;
  const templateCount=live(data.templates).filter(template=>(!template.type||['issue','issues','document','project'].includes(template.type))&&(template.teamId===team.id||template.properties?.teamId===team.id)).length;
  const recurringCount=live(data.issues).filter(issue=>issue.teamId===team.id&&issue.recurrence).length;
  const statusCount=live(data.statuses).filter(status=>status.teamId===team.id).length;
  const countLabel=(count:number,noun:string,plural=`${noun}s`)=>count?`${count} ${count===1?noun:plural}`:'None';
  return (
    <>
      {tab==='Overview'?<header className="team-overview-header">
        <Link to="/settings/teams" className="team-overview-back"><ChevronRight size={13}/>Teams</Link>
        <div><h1>{team.name}</h1><p>{team.private?'Accessible only to team members':team.visibility==='restricted'?'Accessible to parent team members':'Accessible to all workspace members'}</p></div>
        <button type="button" onClick={()=>openTab('Overview')}>Team overview <ChevronRight size={13}/></button>
      </header>:<SettingTitle title={team.name} description={`${team.key || team.identifier} team settings`}/>}
      {tab!=="Overview"&&<Tabs
        items={[
          "General",
          "Members",
          "Workflow",
          "Cycles",
          "Triage",
          "Templates",
          "Recurring issues",
        ]}
        active={tab}
        onChange={openTab}
      />}
      {tab==="Overview"?<div className="team-overview-page">
        <div className="team-overview-card">
          <TeamOverviewRow title="General" description="Name, identifier, timezone, estimates, and broader settings" icon={<Settings size={15}/>} onClick={()=>openTab('General')}/>
          <TeamOverviewRow title="Members" description="Manage team members" value={countLabel(memberIds.size,'member')} icon={<Users size={15}/>} onClick={()=>openTab('Members')}/>
          <TeamOverviewRow title="Slack notifications" description="Broadcast notifications to Slack" value="Off" icon={<MessageSquare size={15}/>} href="/settings/integrations"/>
        </div>
        <section className="team-overview-section"><h2>Issues, projects, and docs</h2><div className="team-overview-card">
          <TeamOverviewRow title="Issue labels" description="Labels available to this team’s issues" value={countLabel(labelCount,'label')} icon={<Tag size={15}/>} onClick={()=>openTab('Issue labels')}/>
          <TeamOverviewRow title="Templates" description="Pre-filled templates for issues, documents, and projects" value={countLabel(templateCount,'template')} icon={<FileText size={15}/>} onClick={()=>openTab('Templates')}/>
          <TeamOverviewRow title="Recurring issues" description="Automatically create issues on a schedule" value={countLabel(recurringCount,'recurring issue')} icon={<Repeat2 size={15}/>} onClick={()=>openTab('Recurring issues')}/>
        </div></section>
        <section className="team-overview-section"><h2>Workflow</h2><div className="team-overview-card">
          <TeamOverviewRow title="Issue statuses" description="Customize the statuses issues go through" value={countLabel(statusCount,'status','statuses')} icon={<CircleDot size={15}/>} onClick={()=>openTab('Workflow')}/>
          <TeamOverviewRow title="Workflows & automations" description="Manage issue automations, git workflows and other workflows" icon={<GitBranch size={15}/>} onClick={()=>openTab('Workflow')}/>
          <TeamOverviewRow title="Triage" description="Streamline how you handle requests from outside your team" value={team.triageEnabled?'On':'Off'} icon={<Inbox size={15}/>} onClick={()=>openTab('Triage')}/>
          <TeamOverviewRow title="Cycles" description="Focus your team over short, time-boxed windows" value={team.cycleEnabled||team.cyclesEnabled?'On':'Off'} icon={<Repeat2 size={15}/>} onClick={()=>openTab('Cycles')}/>
        </div></section>
        <section className="team-overview-section team-hierarchy-section"><h2>Team hierarchy</h2><p>Teams can be nested to reflect your team structure and to share workflows and settings. <a href="https://parabolic.app/docs/sub-teams" target="_blank" rel="noreferrer">Docs</a></p><div className="team-overview-card"><div className="team-overview-static-row"><span className="team-overview-row-icon"><Network size={15}/></span><span className="team-overview-row-copy"><strong>Parent team</strong></span><PreferenceSelect label="Parent team" value={team.parentId??''} values={optionList(data.teams.filter(candidate=>candidate.id!==team.id&&!descendant(candidate)),'No parent team')} onChange={value=>setPendingParent(value||null)}/></div></div></section>
        <TeamLifecycleControls team={team} variant="overview"/>
      </div>:tab === "Recurring issues" ? <RecurringIssueSettings teamId={teamId}/> : tab === "Templates" ? (
        <TemplatesSettings teamId={teamId} />
      ) : tab === "Issue labels" ? (
        <Labels entityType="issues" teamId={teamId}/>
      ) : tab === "General" ? (
        <>
          <SettingSection title="General">
            <SettingRow title="Name">
              <span>{team.name}</span>
              <Action onClick={() => setEdit(true)}>Edit</Action>
            </SettingRow>
            <SettingRow title="Membership" description="Joining a sub-team also joins its parent teams."><Action onClick={()=>act(async()=>{const joined=team.memberIds?.includes(user?.id)||team.ownerIds?.includes(user?.id)||data.memberships.some(m=>m.teamId===team.id&&m.userId===user?.id)||(team.ownerId||team.creatorId)===user?.id;await apiRequest(`/api/v1/teams/${team.id}/${joined?'leave':'join'}`,{method:'POST'});await reload()})}>{team.memberIds?.includes(user?.id)||team.ownerIds?.includes(user?.id)||data.memberships.some(m=>m.teamId===team.id&&m.userId===user?.id)||(team.ownerId||team.creatorId)===user?.id?'Leave team':'Join team'}</Action></SettingRow><SettingRow title="Team owners" description="Owners can manage access and permissions. Parent team owners also own sub-teams."><MultipleProperty label="Team owners" values={team.ownerIds??(team.ownerId||team.creatorId?[team.ownerId||team.creatorId]:[])} options={optionList(data.users.filter(person=>data.memberships.some(m=>!m.teamId&&m.userId===person.id&&!['guest'].includes(m.role)))).filter(option=>option.value)} onChange={ownerIds=>patch({ownerIds})}/></SettingRow><SettingRow title="Identifier">
              <span>{team.key || team.identifier}</span>
            </SettingRow>
            <SettingRow title="Parent team" description="Up to five levels. Moving teams preserves used labels and templates as independent copies.">
              <PreferenceSelect
                label="Parent team"
                value={team.parentId ?? ""}
                values={optionList(
                  data.teams.filter((t) => t.id !== team.id && !descendant(t)),
                  "No parent team",
                )}
                onChange={(v) => setPendingParent(v||null)}
              />
            </SettingRow>
            <SettingRow title="Icon"><EntityIconPicker label="Team icon" fallback="Users" icon={team.icon} color={team.color} onChange={patch}/></SettingRow>
            <SettingRow title="Color">
              <input
                aria-label="Team color"
                type="color"
                value={team.color || "#7775df"}
                onChange={(e) => patch({ color: e.target.value })}
              />
            </SettingRow>
            <SettingRow title="Team access" description={team.visibility==='restricted'?'Members of the parent team can see this team and join it.':team.private?'Only explicitly added members can access this team’s work.':'Every workspace member can access this team.'}><PreferenceSelect label="Team visibility" value={team.visibility||(team.private?'private':'public')} values={parent?.private?[{value:'restricted',label:'Restricted'},{value:'private',label:'Private'}]:[{value:'public',label:'Public'},{value:'private',label:'Private'}]} onChange={visibility=>patch({visibility})}/></SettingRow>
            {([['labelManagement','Issue label management'],['templateManagement','Template management'],['settingsManagement','Team settings management'],['memberManagement','Member management']] as const).map(([key,label])=><SettingRow key={key} title={label} description="Permissions are independent for each team."><PreferenceSelect label={label} value={team[key]||'members'} values={[{value:'members',label:'All members'},{value:'owners',label:'Team owners only'}]} onChange={value=>patch({[key]:value})}/></SettingRow>)}<SettingRow title="Who can join" description="Restrict joining to people added or invited by the team."><PreferenceSelect label="Team joining permissions" value={team.joinPolicy||'open'} values={[{value:'open',label:'Anyone in the workspace'},{value:'inviteOnly',label:'Only invited members'}]} onChange={joinPolicy=>patch({joinPolicy})}/></SettingRow>
            <SettingRow title="Issue sharing" description="Allow individual issues and their sub-issues to be shared with people outside this team."><Toggle label="Enable issue sharing" value={!!team.issueSharingEnabled} onChange={issueSharingEnabled=>patch({issueSharingEnabled})}/></SettingRow>{team.issueSharingEnabled&&<SettingRow title="Who can share issues"><PreferenceSelect label="Issue sharing permissions" value={team.issueSharingPolicy||'members'} values={[{value:'members',label:'Team members'},{value:'owners',label:'Team owners'}]} onChange={issueSharingPolicy=>patch({issueSharingPolicy})}/></SettingRow>}<SettingRow title="Timezone">
              <PreferenceSelect
                label="Team timezone"
                value={
                  team.timezone ||
                  Intl.DateTimeFormat().resolvedOptions().timeZone
                }
                values={Intl.supportedValuesOf("timeZone")}
                onChange={(v) => patch({ timezone: v })}
              />
            </SettingRow>
          </SettingSection>
          <SettingSection title="Estimates">
            {team.parentId && (
              <SettingRow title="Inherit parent estimates">
                <Toggle
                  label="Inherit parent estimates"
                  value={!!team.inheritEstimates}
                  onChange={(v) => patch({ inheritEstimates: v })}
                />
              </SettingRow>
            )}
            {team.inheritEstimates&&parent&&<p className="muted">Estimates follow <Link to={`/settings/team-${parent.id}`}>{parent.name}</Link>.</p>}<fieldset disabled={!!team.inheritEstimates} style={{border:0,padding:0,margin:0}}><SettingRow title="Estimation scale">
              <PreferenceSelect
                label="Estimation scale"
                value={team.estimateScale || "Fibonacci"}
                values={[
                  "Exponential",
                  "Fibonacci",
                  "Parabolic",
                  "T-shirt",
                  "None",
                ]}
                onChange={(v) => patch({ estimateScale: v })}
              />
            </SettingRow>
            <SettingRow
              title="Extended estimates"
              description="Include the two largest values in the scale"
            >
              <Toggle
                label="Extended estimates"
                value={!!team.extendedEstimates}
                onChange={(v) => patch({ extendedEstimates: v })}
              />
            </SettingRow>
            <SettingRow title="Count unestimated issues as one point">
              <Toggle
                label="Unestimated issues count as one"
                value={team.unestimatedAsOne !== false}
                onChange={(v) => patch({ unestimatedAsOne: v })}
              />
            </SettingRow>
            </fieldset><SettingRow
              title="Automatically complete parent issues"
              description="Complete a parent when all its sub-issues are completed"
            >
              <Toggle
                label="Complete parent issues"
                value={!!team.autoCloseParentIssues}
                onChange={(v) => patch({ autoCloseParentIssues: v })}
              />
            </SettingRow>
            <SettingRow title="Complete sub-issues with their parent">
              <Toggle
                label="Complete sub-issues"
                value={!!team.autoCloseSubIssues}
                onChange={(v) => patch({ autoCloseSubIssues: v })}
              />
            </SettingRow>
            <fieldset disabled={!!team.inheritEstimates} style={{border:0,padding:0,margin:0}}><SettingRow title="Allow zero estimates">
              <Toggle
                label="Allow zero estimates"
                value={team.zeroEstimate !== false}
                onChange={(v) => patch({ zeroEstimate: v })}
              />
            </SettingRow></fieldset>
          </SettingSection>
        </>
      ) : tab === "Members" ? (
        <Members teamId={team.id} />
      ) : tab === "Workflow" ? (
        <>{parent&&<SettingSection title="Workflow inheritance"><SettingRow title="Inherit parent workflow" description={`Match ${parent.name} statuses and normalize existing issues by workflow category.`}><Toggle label="Inherit parent workflow" value={!!team.inheritStatuses} onChange={inheritStatuses=>patch({inheritStatuses})}/></SettingRow></SettingSection>}{team.inheritStatuses&&parent?<><p className="muted">Statuses follow <Link to={`/settings/team-${parent.id}`}>{parent.name}</Link>. Make changes on the parent team.</p><div className="feature-settings-card">{live(data.statuses).filter(status=>status.teamId===team.id).sort((a,b)=>(a.position||0)-(b.position||0)).map(status=><div className="feature-settings-row" key={status.id}><span>{status.name}</span><span className="muted">{status.type}</span></div>)}</div><WorkflowAutomationSettings teamId={team.id}/><RoutingRules teamId={team.id}/></>:<Workflows teamId={team.id}/>}</>
      ) : tab === "Cycles" ? (
        <CycleSettings team={team}/>
      ) : (
        <>
          <SettingSection title="Triage">
            <SettingRow
              title="Enable triage"
              description="Review incoming work before it enters the backlog"
            >
              <Toggle
                label="Enable triage"
                value={!!team.triageEnabled}
                onChange={async (v) => {
                  await patch({ triageEnabled: v });
                  if (
                    v &&
                    !data.statuses.some(
                      (s) => s.teamId === team.id && s.type === "triage",
                    )
                  )
                    await act(() =>
                      create("statuses", {
                        name: "Triage",
                        type: "triage",
                        color: "#f2c94c",
                        teamId: team.id,
                      }),
                    );
                }}
              />
            </SettingRow>
            <TriageResponsibilitySettings team={team}/>
            <SettingRow title="Default SLA">
              <PreferenceSelect
                label="Default SLA"
                value={team.slaPolicyId || ""}
                values={optionList(data.slaPolicies, "None")}
                onChange={(v) => patch({ slaPolicyId: v })}
              />
            </SettingRow>
          </SettingSection>
          <RoutingRules teamId={team.id} />
        </>
      )}
      {pendingParent&&<TeamNestingWizard teamId={team.id} parentId={pendingParent} onClose={()=>setPendingParent(undefined)}/>}
      {pendingParent===null&&<Confirm title={pendingParent?'Change parent team?':'Remove parent team?'} description={pendingParent?'This changes inherited cycles and the labels and templates available to this team. Used labels and templates from the previous parent are preserved as independent copies.':'Inherited settings become independent. Used parent labels and templates are preserved as copies; unused parent labels and templates will no longer be available.'} onClose={()=>setPendingParent(undefined)} onConfirm={()=>patch({parentId:pendingParent})}/>}
      {edit && (
        <FormDialog
          title="Edit team"
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "key", label: "Identifier", required: true },
            { key: "description", label: "Description", type: "textarea" },
          ]}
          initial={{ ...team, key: team.key || team.identifier }}
          submit="Save changes"
          onClose={() => setEdit(false)}
          onSave={(v) =>
            patch({
              ...v,
              key: v.key.toUpperCase(),
              identifier: v.key.toUpperCase(),
            })
          }
        />
      )}
    </>
  );
}
type MemberDirectoryFilterProps={memberships:any[];teams:any[];currentUserId?:string;statuses:string[];teamIds:string[];onStatuses:(values:string[])=>void;onTeams:(values:string[])=>void;onAdvanced:()=>void;triggerLabel:string};
function MemberDirectoryFilter({memberships,teams,currentUserId,statuses,teamIds,onStatuses,onTeams,onAdvanced,triggerLabel}:MemberDirectoryFilterProps){
 const[panel,setPanel]=useState<'root'|'status'|'teams'|'advanced'>('root'),[query,setQuery]=useState('');
 const searchRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{requestAnimationFrame(()=>searchRef.current?.focus())},[panel]);
 const memberIds=(team:any)=>new Set<string>([...(team.memberIds||[]),...(team.ownerIds||[]),team.ownerId,team.creatorId,...memberships.filter(m=>m.teamId===team.id).map(m=>m.userId)].filter(Boolean));
 const liveTeams=teams.filter(team=>!team.deletedAt),myTeams=liveTeams.filter(team=>memberIds(team).has(currentUserId||''));
 const workspaceMemberships=memberships.filter(m=>!m.teamId),role=(m:any)=>['owner','admin'].includes(m.role||'')?'admin':m.role==='guest'?'guest':'member';
 const statusChoices=[['admin','Admin'],['guest','Guest'],['member','Member']] as const;
 const teamChoices=[{id:'my-teams',name:'My teams',count:workspaceMemberships.filter(m=>myTeams.some(team=>memberIds(team).has(m.userId))).length},...liveTeams.map(team=>({id:team.id,name:team.name,count:workspaceMemberships.filter(m=>memberIds(team).has(m.userId)).length}))];
 const statusCount=(id:string)=>workspaceMemberships.filter(m=>role(m)===id).length,countLabel=(count:number)=>count?`${count} ${count===1?'member':'members'}`:'';
 const toggle=(values:string[],value:string,set:(next:string[])=>void)=>set(values.includes(value)?values.filter(item=>item!==value):[...values,value]);
 const normalized=query.trim().toLowerCase();
 const rootLeaves=[...statusChoices.map(([id,name])=>({group:'Status',id,name,count:statusCount(id)})),...teamChoices.map(item=>({group:'Teams',...item}))];
 const rootParents=[{id:'status',name:'Status'},{id:'teams',name:'Teams'}] as const;
 const rootRows=normalized?[...rootParents.filter(item=>item.name.toLowerCase().includes(normalized)).map(item=>({kind:'parent' as const,...item})),...rootLeaves.filter(item=>item.name.toLowerCase().includes(normalized)||item.group.toLowerCase().includes(normalized)).map(item=>({kind:'leaf' as const,...item}))]:[];
 const shownStatus=statusChoices.filter(([,name])=>name.toLowerCase().includes(normalized));
 const shownTeams=teamChoices.filter(item=>item.name.toLowerCase().includes(normalized));
 const shownCount=panel==='root'?(normalized?rootRows.length:3):panel==='status'?shownStatus.length:panel==='teams'?shownTeams.length:shownStatus.length+shownTeams.length;
 const open=(next:'status'|'teams'|'advanced')=>{setPanel(next);setQuery('')},reset=()=>{setPanel('root');setQuery('')};
 const statusChoice=([id,name]:typeof statusChoices[number])=><label className="member-directory-filter-option" role="option" aria-selected={statuses.includes(id)} data-keep-open key={id}><input type="checkbox" checked={statuses.includes(id)} onChange={()=>toggle(statuses,id,onStatuses)}/><span>{name}</span><small>{countLabel(statusCount(id))}</small></label>;
 const teamChoice=(item:typeof teamChoices[number],index:number)=><React.Fragment key={item.id}>{index===1&&<div className="member-directory-filter-section">My teams</div>}<label className="member-directory-filter-option" role="option" aria-selected={teamIds.includes(item.id)} data-keep-open><input type="checkbox" checked={teamIds.includes(item.id)} onChange={()=>toggle(teamIds,item.id,onTeams)}/><span>{item.name}</span><small>{countLabel(item.count)}</small></label></React.Fragment>;
 return <Dropdown align="right" menuClassName="member-directory-filter-menu" onOpenChange={opened=>{if(!opened)reset()}} trigger={<button className="feature-icon-button" aria-label={triggerLabel}><Icon name={triggerLabel==='Add another filter'?'Plus':'Filter'} size={14}/></button>}>
  <div className="member-directory-filter" onKeyDown={event=>{if(event.key==='Escape'&&panel!=='root'){event.preventDefault();event.stopPropagation();reset()}}}>
   <div className="member-directory-filter-search" data-keep-open><span role="status">{!normalized?'Showing all items':`Showing ${shownCount} ${shownCount===1?'item':'items'}`}</span><input ref={searchRef} autoFocus type="search" aria-label={panel==='root'?'Add Filter…':'Filter…'} placeholder={panel==='root'?'Add Filter…':'Filter…'} value={query} onChange={event=>setQuery(event.target.value)}/>{panel==='root'&&<kbd>F</kbd>}</div>
   {panel!=='root'&&<button type="button" data-keep-open className="member-directory-filter-back" role="menuitem" onClick={reset}><Icon name="ChevronLeft" size={13}/><span>{panel==='advanced'?'Advanced filter':panel==='status'?'Status':'Teams'}</span></button>}
   <div role="listbox" aria-label={panel==='root'?'Member filter fields':panel==='status'?'Member statuses':panel==='teams'?'Member teams':'Advanced member filters'} aria-multiselectable={panel!=='root'} className="member-directory-filter-options">
    {panel==='root'&&!normalized&&<><button type="button" role="option" aria-selected="false" onClick={onAdvanced}><Icon name="ListFilter" size={14}/><span>Advanced filter</span></button><button type="button" role="option" aria-selected="false" data-keep-open onClick={()=>open('status')}><Icon name="CircleDot" size={14}/><span>Status</span><Icon name="ChevronRight" size={12}/></button><button type="button" role="option" aria-selected="false" data-keep-open onClick={()=>open('teams')}><Icon name="Users" size={14}/><span>Teams</span><Icon name="ChevronRight" size={12}/></button></>}
    {panel==='root'&&normalized&&rootRows.map(item=>item.kind==='parent'?<button type="button" role="option" aria-selected="false" data-keep-open key={'parent:'+item.id} onClick={()=>open(item.id)}><Icon name={item.id==='status'?'CircleDot':'Users'} size={14}/><span>{item.name}</span><Icon name="ChevronRight" size={12}/></button>:<label className="member-directory-filter-option flattened" role="option" aria-selected={item.group==='Status'?statuses.includes(item.id):teamIds.includes(item.id)} data-keep-open key={item.group+':'+item.id}><input type="checkbox" checked={item.group==='Status'?statuses.includes(item.id):teamIds.includes(item.id)} onChange={()=>item.group==='Status'?toggle(statuses,item.id,onStatuses):toggle(teamIds,item.id,onTeams)}/><span><em>{item.group}<Icon name="ChevronRight" size={9}/></em>{item.name}</span><small>{countLabel(item.count)}</small></label>)}
    {panel==='status'&&shownStatus.map(statusChoice)}
    {panel==='teams'&&shownTeams.map(teamChoice)}
    {panel==='advanced'&&<><div className="member-directory-filter-section">Status</div>{shownStatus.map(statusChoice)}<div className="member-directory-filter-section">Teams</div>{shownTeams.map(teamChoice)}</>}
   </div>
  </div>
 </Dropdown>;
}

export function Members({ teamId,directory=false }: { teamId?: string;directory?:boolean }) {
  const { data, user, create, update, remove, reload, act } = useActions();
  const navigate=useNavigate();
  const initialMemberParams=new URLSearchParams(window.location.search);
  const initialDirectoryStatuses=initialMemberParams.get('memberStatus')?.split(',').filter(Boolean)??[],initialDirectoryTeams=initialMemberParams.get('memberTeam')?.split(',').filter(Boolean)??[];
  const [add, setAdd] = useState(initialMemberParams.get('invite')==='1'),
    [invite, setInvite] = useState<any>(null),
    [inviteTeams,setInviteTeams]=useState<string[]>([]),
    [inviteTeamPicker,setInviteTeamPicker]=useState(false),
    [suspending,setSuspending]=useState<any>(null),[inactiveMembers,setInactiveMembers]=useState<any[]>([]),[restoring,setRestoring]=useState<any>(null),[query,setQuery]=useState(''),[status,setStatus]=useState(initialMemberParams.get('status')||'All'),[directoryStatuses,setDirectoryStatuses]=useState<string[]>(initialDirectoryStatuses),[directoryTeams,setDirectoryTeams]=useState<string[]>(initialDirectoryTeams),[directoryAdvanced,setDirectoryAdvanced]=useState(initialMemberParams.get('memberAdvanced')==='1'),[memberMenu,setMemberMenu]=useState<string|null>(null),[sortAscending,setSortAscending]=useState(()=>directory?localStorage.getItem('parabolic:members:sort-direction')!=='desc':true),[sortField,setSortField]=useState<'name'|'email'|'status'|'joined'|'lastSeen'>(()=>{if(!directory)return'name';const saved=localStorage.getItem('parabolic:members:sort-field');return saved==='status'||saved==='joined'?saved:'name'}),[memberProperties,setMemberProperties]=useState<string[]>(()=>{if(!directory)return['status','joined','teams'];try{const saved=JSON.parse(localStorage.getItem('parabolic:members:properties')||'null');return Array.isArray(saved)?saved.filter(value=>['status','joined','teams'].includes(value)):['status','joined','teams']}catch{return['status','joined','teams']}}),[editingMember,setEditingMember]=useState<{membership:any;field:'name'|'username'|'email'}|null>(null),[manageTeamsMember,setManageTeamsMember]=useState<any>(null),[leavingSelf,setLeavingSelf]=useState(false);
  const team = data.teams.find((t) => t.id === teamId);
  const actualMemberships = live(data.memberships).filter((m) =>
    teamId ? m.teamId === teamId : !m.teamId,
  );
  const memberships = [
    ...actualMemberships,
    ...([...new Set([...(team?.memberIds??[]),...(team?.ownerIds??(team?.ownerId||team?.creatorId?[team.ownerId||team.creatorId]:[]))])])
      .filter((id: string) => !actualMemberships.some((m) => m.userId === id))
      .map((userId: string) => ({
        id: `embedded:${userId}`,
        userId,
        role: "member",
        embedded: true,
      })),
  ];
  const loadInactive=()=>apiRequest('/auth/workspace/left-members').then(result=>setInactiveMembers(result.nodes||[])).catch(()=>setInactiveMembers([]));
  useEffect(()=>{if(!teamId)void loadInactive()},[data.workspaceId,teamId]);
  useEffect(()=>{if(!directory)return;const params=new URLSearchParams(window.location.search);if(directoryStatuses.length)params.set('memberStatus',directoryStatuses.join(','));else params.delete('memberStatus');if(directoryTeams.length)params.set('memberTeam',directoryTeams.join(','));else params.delete('memberTeam');if(directoryAdvanced)params.set('memberAdvanced','1');else params.delete('memberAdvanced');const next=window.location.pathname+(params.size?'?'+params:'')+window.location.hash;if(next!==window.location.pathname+window.location.search+window.location.hash)window.history.replaceState(window.history.state,'',next)},[directory,directoryStatuses,directoryTeams,directoryAdvanced]);
  useEffect(()=>{if(!directory)return;localStorage.setItem('parabolic:members:sort-field',sortField);localStorage.setItem('parabolic:members:sort-direction',sortAscending?'asc':'desc');localStorage.setItem('parabolic:members:properties',JSON.stringify(memberProperties))},[directory,sortField,sortAscending,memberProperties]);
  const matchesQuery=(person:any)=>!query||[person?.name,person?.email,person?.username].some(v=>String(v||'').toLowerCase().includes(query.toLowerCase()));
  const directoryRole=(membership:any)=>['owner','admin'].includes(membership.role||'')?'admin':membership.role==='guest'?'guest':'member';
  const teamMemberIds=(teamValue:any)=>new Set<string>([...(teamValue.memberIds||[]),...(teamValue.ownerIds||[]),teamValue.ownerId,teamValue.creatorId,...live(data.memberships).filter(m=>m.teamId===teamValue.id).map(m=>m.userId)].filter(Boolean));
  const myTeamIds=data.teams.filter(teamValue=>!teamValue.deletedAt&&teamMemberIds(teamValue).has(user?.id||'')).map(teamValue=>teamValue.id);
  const matchesDirectoryFilters=(membership:any)=>{
    if(!directory)return true;
    if(directoryStatuses.length&&!directoryStatuses.includes(directoryRole(membership)))return false;
    if(directoryTeams.length){const wanted=new Set(directoryTeams.flatMap(id=>id==='my-teams'?myTeamIds:[id]));if(![...wanted].some(id=>teamMemberIds(data.teams.find(teamValue=>teamValue.id===id)||{}).has(membership.userId)))return false;}
    return true;
  };
  const shownMemberships=memberships.filter(m=>{
    const person=data.users.find(u=>u.id===m.userId),pending='pendingInvitation' in m&&m.pendingInvitation;
    if(!matchesQuery(person))return false;
    if(teamId)return true;
    if(directory)return !pending&&matchesDirectoryFilters(m);
    if(status==='All'||status==='Members')return !pending;
    if(status==='Pending invites')return !!pending;
    return false;
  });
  const shownInactive=inactiveMembers.filter(member=>matchesQuery(member.user)&&(status==='Suspended'?!!member.suspendedAt:status==='Left workspace'?!member.suspendedAt:false));
  const showApplication=!teamId&&(!directory?(status==='All'||status==='Applications'):!directoryStatuses.length&&!directoryTeams.length)&&(!query||['parabolic','application'].some(value=>value.includes(query.toLowerCase())));
  const memberGroup=status==='All'||status==='Members'?'Active':status;
  const orderMembers=(field:typeof sortField)=>{if(sortField===field)setSortAscending(value=>!value);else{setSortField(field);setSortAscending(true)}};
  const memberSortValue=(membership:any)=>{const person=data.users.find(u=>u.id===membership.userId);if(sortField==='email')return person?.email||'';if(sortField==='status')return ('pendingInvitation' in membership&&membership.pendingInvitation)?'Invited':membership.role||'member';if(sortField==='joined')return membership.createdAt||person?.createdAt||'';if(sortField==='lastSeen')return membership.userId===user?.id?'9999':person?.lastSeenAt||'';return person?.name||''};
  return (
    <div className={!teamId?`members-settings-page settings-wide ${directory?'members-directory-page':''}`:''}>
      <SettingTitle
        title={teamId ? "Team members" : "Members"}
        action={
          <AddButton onClick={() => {setInviteTeams([]);setAdd(true)}}>
            {teamId ? "Add member" : directory ? "Invite members" : "Invite"}
          </AddButton>
        }
      />
      {!teamId&&<><div className="members-toolbar"><SearchBox value={query} onChange={setQuery} placeholder={directory?'Find members…':'Search by name or email'}/>{directory?<><div/><MemberDirectoryFilter memberships={live(data.memberships).filter(m=>!('pendingInvitation' in m&&m.pendingInvitation))} teams={data.teams.filter(teamValue=>!teamValue.deletedAt)} currentUserId={user?.id} statuses={directoryStatuses} teamIds={directoryTeams} onStatuses={setDirectoryStatuses} onTeams={setDirectoryTeams} onAdvanced={()=>setDirectoryAdvanced(true)} triggerLabel={directoryAdvanced||directoryStatuses.length||directoryTeams.length?'Add another filter':'Add filter'}/><Dropdown align="right" trigger={<button className="feature-icon-button" aria-label="Display options"><Icon name="SlidersHorizontal" size={14}/></button>}><div className="member-directory-display" data-keep-open><div className="member-directory-order"><span>Ordering</span><button type="button" className="icon-button" aria-label="Direction" title={sortAscending?'Ascending':'Descending'} onClick={()=>setSortAscending(value=>!value)}><Icon name={sortAscending?'ArrowUpNarrowWide':'ArrowDownWideNarrow'} size={13}/></button><select aria-label="Member ordering" value={sortField} onChange={event=>setSortField(event.target.value as typeof sortField)}><option value="name">Name</option><option value="status">Status</option><option value="joined">Joined</option></select></div><div className="menu-label">Display properties</div><div className="member-directory-properties">{[['status','Status'],['joined','Joined'],['teams','Teams']].map(([field,label])=><button type="button" key={field} aria-pressed={memberProperties.includes(field)} onClick={()=>setMemberProperties(values=>values.includes(field)?values.filter(value=>value!==field):[...values,field])}>{label}</button>)}</div></div></Dropdown></>:<><SettingsToolbarSelect label="Member status" value={status} options={['All','Members','Applications','Pending invites','Suspended','Left workspace']} onChange={setStatus}/><div/><Action onClick={()=>downloadCsv('members.csv',['Name,Email,Status,Teams,Joined,Last seen',...shownMemberships.map(m=>{const u=data.users.find(x=>x.id===m.userId);return [u?.name,u?.email,'pendingInvitation' in m&&m.pendingInvitation?'Pending invite':m.role||'Member',data.memberships.filter(x=>x.userId===m.userId&&x.teamId).length,(m as any).createdAt||'',u?.lastSeenAt||''].join(',')})].join('\n'))}>Export CSV</Action><Action primary aria-label="Invite member" onClick={()=>{setInviteTeams([]);setInviteTeamPicker(false);setAdd(true)}}>Invite</Action></>}</div>{directory&&(directoryAdvanced||directoryStatuses.length>0||directoryTeams.length>0)&&<div className={`member-directory-active-filters${directoryAdvanced?' advanced':''}`}><div className="member-directory-filter-chips" aria-label="Active member filters">{directoryAdvanced&&<span className="member-directory-advanced-chip"><button aria-label="Open advanced filter">Advanced filter</button><button aria-label="Remove advanced filter" onClick={()=>setDirectoryAdvanced(false)}><Icon name="X" size={11}/></button></span>}{directoryStatuses.map(value=><button key={'status:'+value} onClick={()=>setDirectoryStatuses(values=>values.filter(item=>item!==value))}>Status <span>{value==='admin'?'Admin':value==='guest'?'Guest':'Member'}</span><Icon name="X" size={11}/></button>)}{directoryTeams.map(value=><button key={'team:'+value} onClick={()=>setDirectoryTeams(values=>values.filter(item=>item!==value))}>Teams <span>{value==='my-teams'?'My teams':data.teams.find(teamValue=>teamValue.id===value)?.name||value}</span><Icon name="X" size={11}/></button>)}<MemberDirectoryFilter memberships={live(data.memberships).filter(m=>!('pendingInvitation' in m&&m.pendingInvitation))} teams={data.teams.filter(teamValue=>!teamValue.deletedAt)} currentUserId={user?.id} statuses={directoryStatuses} teamIds={directoryTeams} onStatuses={setDirectoryStatuses} onTeams={setDirectoryTeams} onAdvanced={()=>setDirectoryAdvanced(true)} triggerLabel="Add another filter"/></div><div className="member-directory-filter-actions"><button type="button" aria-label="Clear all filters" disabled={!directoryStatuses.length&&!directoryTeams.length} onClick={()=>{setDirectoryStatuses([]);setDirectoryTeams([])}}>Clear all filters</button></div>{directoryAdvanced&&<div className="member-directory-advanced-builder"><button type="button" aria-label="Filter" onClick={()=>document.querySelector<HTMLButtonElement>('.member-directory-filter-chips [aria-label="Add another filter"]')?.click()}><Plus size={12}/>Filter</button></div>}</div>}</>}
      <div role={!teamId?'table':undefined} aria-label={!teamId?'Members':undefined} className={!teamId?'members-table':'feature-settings-card'}>
        {!teamId&&<><div role="row" className="members-table-head"><button role="columnheader" aria-label="Order by Name" onClick={()=>orderMembers('name')}>Name{sortField==='name'?` ${sortAscending?'↓':'↑'}`:''}</button>{!directory&&<button role="columnheader" aria-label="Order by Email" onClick={()=>orderMembers('email')}>Email{sortField==='email'?` ${sortAscending?'↓':'↑'}`:''}</button>}{(!directory||memberProperties.includes('status'))&&<button role="columnheader" aria-label="Order by Status" onClick={()=>orderMembers('status')}>Status{sortField==='status'?` ${sortAscending?'↓':'↑'}`:''}</button>}{(!directory||memberProperties.includes('joined'))&&<button role="columnheader" aria-label="Order by Joined" onClick={()=>orderMembers('joined')}>Joined{sortField==='joined'?` ${sortAscending?'↓':'↑'}`:''}</button>}{(!directory||memberProperties.includes('teams'))&&<span role="columnheader">Teams</span>}<button role="columnheader" aria-label="Order by Last seen" onClick={()=>orderMembers('lastSeen')}>Last seen{sortField==='lastSeen'?` ${sortAscending?'↓':'↑'}`:''}</button><span/></div>{!directory&&status!=='Applications'&&<div className="members-table-group">{memberGroup} <span>{status==='Suspended'||status==='Left workspace'?shownInactive.length:shownMemberships.length}</span></div>}</>}
        {shownMemberships.sort((a,b)=>(sortAscending?1:-1)*String(memberSortValue(a)).localeCompare(String(memberSortValue(b)))).map((m) => {
          const person=data.users.find(u=>u.id===m.userId);
          const joined=person?memberJoinedLabel(person,m as Entity):undefined;
          const MemberRow:any=directory?Link:'div';
          return <MemberRow {...(directory?{to:`/profiles/${m.userId}`}:{role:!teamId?'row':undefined})} onKeyDown={directory?(event:React.KeyboardEvent)=>{if(event.key===' '){event.preventDefault();navigate(`/profiles/${m.userId}`)}}:undefined} className={!teamId?`members-table-row feature-settings-row${directory?' member-directory-link-row':''}`:'feature-settings-row'} key={m.id}>
            {!teamId?<div className="member-identity"><Person id={m.userId}/><small>{person?.username||String(person?.email||'').split('@')[0]}</small></div>:<Person id={m.userId} />}
            {!directory&&<span className="muted">
              {person?.email}
            </span>}
            {!teamId&&<>{(!directory||memberProperties.includes('status'))&&<span className="member-role">{("pendingInvitation" in m&&m.pendingInvitation)?"Invited":m.role==='owner'?"Admin":String(m.role||'member').replace(/^./,c=>c.toUpperCase())}</span>}{(!directory||memberProperties.includes('joined'))&&<span className="muted">{joined?joined.replace(/,\s*\d{1,2}:\d{2}.*$/,''):'—'}</span>}{(!directory||memberProperties.includes('teams'))&&<span className="muted">{data.memberships.filter(x=>x.userId===m.userId&&x.teamId&&!x.deletedAt).map(x=>data.teams.find(team=>team.id===x.teamId)?.name).filter(Boolean).join(', ')||'—'}</span>}<span className="muted">{m.userId===user?.id?<><i className="member-online"/>Online</>:person?.lastSeenAt?date(person.lastSeenAt):'—'}</span></>}
            {teamId&&<PreferenceSelect
              label="Member role"
              value={teamId&&(team?.ownerIds??[team?.ownerId||team?.creatorId]).includes(m.userId)?'owner':m.role||'member'}
              values={teamId?['owner','member']:['owner','admin','member','guest']}
              onChange={v=>act(()=>m.embedded?create('memberships',{teamId,userId:m.userId,role:v}):update('memberships',m.id,{role:v}))}
            />}
            {!teamId&&!directory&&<div className="member-menu-anchor"><button aria-label={`${person?.name||'Member'} actions`} className="feature-icon-button members-row-menu" onClick={()=>setMemberMenu(memberMenu===m.id?null:m.id)}><MoreHorizontal size={16}/></button>{memberMenu===m.id&&<div className="member-actions-menu">{m.userId===user?.id?<button onClick={()=>{setMemberMenu(null);setLeavingSelf(true)}}>Leave workspace…</button>:<><button onClick={()=>{setMemberMenu(null);setEditingMember({membership:m,field:'name'})}}>Update name…</button><button onClick={()=>{setMemberMenu(null);setEditingMember({membership:m,field:'username'})}}>Update username…</button><button onClick={()=>{setMemberMenu(null);setEditingMember({membership:m,field:'email'})}}>Update email…</button><button className="member-menu-separated" onClick={()=>{setMemberMenu(null);setSuspending(m)}}>Suspend user…</button><button className="member-menu-separated" onClick={()=>{setMemberMenu(null);setManageTeamsMember(m)}}>Manage teams…</button></>}</div>}</div>}
            {teamId&&<button
              aria-label="Remove member"
              className="feature-icon-button"
              onClick={() =>
                act(async () => {
                  if (!m.embedded) await remove("memberships", m.id);
                  if (team?.memberIds?.includes(m.userId))
                    await update("teams", team.id, {
                      memberIds: team.memberIds.filter(
                        (id: string) => id !== m.userId,
                      ),
                    });
                })
              }
            >
              <Trash2 size={14} />
            </button>}
          </MemberRow>})}
        {!teamId&&(status==='Suspended'||status==='Left workspace')&&shownInactive.map(member=><div className="members-table-row feature-settings-row" key={member.id}><div className="member-identity"><span className="application-avatar">{String(member.user?.name||member.user?.email||'?').slice(0,1).toUpperCase()}</span><span>{member.user?.name||member.user?.email||'Former member'}</span><small>{member.user?.username||String(member.user?.email||'').split('@')[0]}</small></div><span className="muted">{member.user?.email}</span><span className="member-role">{member.suspendedAt?'Suspended':'Left'}</span><span className="muted">—</span><span className="muted">{member.createdAt?date(member.createdAt):'—'}</span><span className="muted">{date(member.suspendedAt||member.leftAt||member.updatedAt)}</span><div className="member-menu-anchor"><button aria-label={`${member.user?.name||'Former member'} actions`} className="feature-icon-button members-row-menu" onClick={()=>setMemberMenu(memberMenu===member.id?null:member.id)}><MoreHorizontal size={16}/></button>{memberMenu===member.id&&<div className="member-actions-menu"><button onClick={()=>{setMemberMenu(null);setRestoring(member)}}>Restore access</button></div>}</div></div>)}
        {showApplication&&<>{!directory&&<div className="members-table-group">Applications <span>1</span></div>}<div className="members-table-row application-row"><div className="member-identity"><span className="application-avatar">◒</span><span>Parabolic</span><small>parabolic</small></div>{directory?<><span className="muted">Application</span><span className="muted">{data.workspaces.find(w=>w.id===data.workspaceId)?.createdAt?date(data.workspaces.find(w=>w.id===data.workspaceId)?.createdAt):'—'}</span><span/><span className="muted">{data.workspaces.find(w=>w.id===data.workspaceId)?.createdAt?date(data.workspaces.find(w=>w.id===data.workspaceId)?.createdAt):'—'}</span><span/></>:<><span/><span className="muted">Application</span><span/><span className="muted">{data.workspaces.find(w=>w.id===data.workspaceId)?.createdAt?date(data.workspaces.find(w=>w.id===data.workspaceId)?.createdAt):'—'}</span><span className="muted">{data.workspaces.find(w=>w.id===data.workspaceId)?.createdAt?date(data.workspaces.find(w=>w.id===data.workspaceId)?.createdAt):'—'}</span><span/></>}</div></>}
      </div>
      {suspending&&<Confirm title="Suspend workspace member?" description="This person will lose workspace access immediately. Their work and team memberships are preserved, and an administrator can restore access later." onClose={()=>setSuspending(null)} onConfirm={async()=>{await apiRequest('/auth/workspace/suspend-member',{method:'POST',body:JSON.stringify({id:suspending.id})});await reload();await loadInactive();return true;}}/>}
      {editingMember&&<FormDialog title={`Update ${editingMember.field}`} fields={[{key:editingMember.field,label:editingMember.field.replace(/^./,letter=>letter.toUpperCase()),required:true}]} initial={{[editingMember.field]:data.users.find(person=>person.id===editingMember.membership.userId)?.[editingMember.field]||''}} submit="Save" onClose={()=>setEditingMember(null)} onSave={values=>act(()=>update('users',editingMember.membership.userId,{[editingMember.field]:values[editingMember.field]}))}/>}
      {manageTeamsMember&&<FormDialog title="Manage teams" fields={data.teams.filter(team=>!team.deletedAt).map(team=>({key:team.id,label:team.name,type:'checkbox'}))} initial={Object.fromEntries(data.teams.map(team=>[team.id,data.memberships.some(membership=>membership.userId===manageTeamsMember.userId&&membership.teamId===team.id&&!membership.deletedAt)]))} submit="Save" onClose={()=>setManageTeamsMember(null)} onSave={async values=>{for(const team of data.teams){const membership=data.memberships.find(candidate=>candidate.userId===manageTeamsMember.userId&&candidate.teamId===team.id&&!candidate.deletedAt);if(values[team.id]&&!membership)await create('memberships',{teamId:team.id,userId:manageTeamsMember.userId,role:'member'});if(!values[team.id]&&membership)await remove('memberships',membership.id)}await reload();return true}}/>}
      {leavingSelf&&<Confirm title="Leave workspace?" description="You will lose access to this workspace. Your existing work will remain available to other members." onClose={()=>setLeavingSelf(false)} onConfirm={async()=>{await apiRequest('/auth/workspace/leave',{method:'POST',body:JSON.stringify({workspaceId:data.workspaceId})});location.assign('/');return true}}/>}
      {restoring&&<Confirm title={`Restore ${restoring.user?.name||'member'}’s access?`} description="This person will be able to sign in again with their existing account and previous workspace role. Previously revoked sessions stay signed out." onClose={()=>setRestoring(null)} onConfirm={async()=>{await apiRequest('/auth/workspace/restore-member',{method:'POST',body:JSON.stringify({id:restoring.id})});await reload();await loadInactive();return true;}}/>}
      {add && (
        <FormDialog
          title={teamId ? "Add team member" : "Invite to your workspace"}
          fields={
            teamId
              ? [
                  {
                    key: "userId",
                    label: "Member",
                    type: "select",
                    required: true,
                    options: optionList(
                      data.users.filter(
                        (u) => !memberships.some((m) => m.userId === u.id),
                      ),
                      "Select member",
                    ),
                  },
                  {
                    key: "role",
                    label: "Role",
                    type: "select",
                    options: ["member", "admin", "guest"].map((x) => ({
                      value: x,
                      label: x,
                    })),
                  },
                ]
              : [{key:"email",label:"Email",type:"textarea",placeholder:"alex@example.com, sam@example.com…",required:true}]
          }
          initial={{ role: "member" }}
          onClose={() => {setAdd(false);setInviteTeamPicker(false)}}
          submit={teamId ? "Add member" : "Send invites"}
          onSave={async (v) => {
            if (teamId)
              return act(() => create("memberships", { ...v, teamId }));
            const result = await api("/api/v1/invitations", {
              method: "POST",
              body: JSON.stringify({...v,role:'member',teamIds:inviteTeams}),
            });
            setInvite(result);
            await reload();
            return result;
          }}
        >{!teamId&&<div className="member-invite-team-field"><span>Add to team <em>(optional)</em></span><button type="button" aria-label="Select teams" aria-expanded={inviteTeamPicker} onClick={()=>setInviteTeamPicker(value=>!value)}>{inviteTeams.length?live(data.teams).filter(team=>inviteTeams.includes(team.id)).map(team=>team.name).join(', '):'Select teams…'}<ChevronDown size={14}/></button>{inviteTeamPicker&&<div className="member-invite-team-menu">{live(data.teams).map(team=><label key={team.id}><span>{team.name}</span><input type="checkbox" aria-label={`Invite to ${team.name}`} checked={inviteTeams.includes(team.id)} onChange={event=>setInviteTeams(previous=>event.target.checked?[...previous,team.id]:previous.filter(id=>id!==team.id))}/></label>)}</div>}</div>}</FormDialog>
      )}
      {invite && (
        <FormDialog
          title="Invitation created"
          fields={[]}
          submit="Done"
          onClose={() => setInvite(null)}
          onSave={async () => true}
        >
          <p className="muted">Invitation emails are queued for delivery. You can also share each link with its recipient.</p>
          {(invite.invitations||[invite]).map((entry:any)=><div key={entry.id}><p>{entry.email}</p><div className="feature-inline"><input className="input" readOnly aria-label="Invitation link" value={entry.url}/><Action onClick={()=>navigator.clipboard.writeText(entry.url)}><Copy size={14}/>Copy</Action></div></div>)}
        </FormDialog>
      )}
    </div>
  );
}

function Collection({
  title,
  description,
  kind,
  fields,
  initial = {},
  filter = () => true,
  subtitle,
  initialScope = "workspace",
}: {
  title: string;
  description?: string;
  kind: EntityKind;
  fields: FormField[];
  initial?: Record<string, any>;
  filter?: (x: Row) => boolean;
  subtitle?: (x: Row) => string;
  initialScope?: string;
}) {
  const { data, create, update, act, initialSyncing } = useActions();
  const [localForm, setLocalForm] = useState<Row | boolean>(false);
  const [inlineName,setInlineName]=useState(''),[inlineDescription,setInlineDescription]=useState('');
  const [selected,setSelected]=useState<Set<string>>(new Set()),[context,setContext]=useState<{x:number;y:number}|null>(null);const anchor=useRef<string|null>(null);
  const [query,setQuery]=useState(''),[scope,setScope]=useState(initialScope),[archived,setArchived]=useState(false);
  const [params, setParams] = useSearchParams();
  const linkedId = kind === 'labels' ? params.get('label') : null;
  const items = data[kind].filter(item=>!item.deletedAt && (archived || scope==='archived' || !item.archivedAt)).filter(filter);
  const shown = items.filter(item=>(!query || [item.name,item.description,item.group].some(value=>String(value||'').toLocaleLowerCase().includes(query.toLocaleLowerCase()))) && (scope==='archived'?!!item.archivedAt:scope==='all'||(scope==='workspace'?!item.teamId:item.teamId===scope)));
  const selectedLabels=shown.filter(label=>selected.has(label.id));
  const toggle=(id:string,range=false)=>{const previousAnchor=anchor.current;setSelected(previous=>{const next=new Set(previous);if(range&&previousAnchor){const from=shown.findIndex(item=>item.id===previousAnchor),to=shown.findIndex(item=>item.id===id);if(from>=0)for(const item of shown.slice(Math.min(from,to),Math.max(from,to)+1))next.add(item.id);else next.add(id)}else if(next.has(id))next.delete(id);else next.add(id);return next});anchor.current=id};
  const usage=useMemo(()=>buildLabelUsage(data),[data.issues,data.projects,data.activities,data.slaPolicies,data.automations]);
  const linkedItem = items.find(item=>item.id===linkedId);
  const creatingLabel=kind==='labels'&&(localForm===true||params.get('new')==='1');
  const closeInlineLabel=()=>{setLocalForm(false);if(params.get('new')==='1'){const next=new URLSearchParams(params);next.delete('new');setParams(next)}};
  const form = linkedId ? (!initialSyncing && linkedItem) : creatingLabel?false:localForm;
  const setForm = (value: Row | boolean) => {
    setLocalForm(kind === 'labels' && typeof value === 'object' ? false : value);
    if (kind !== 'labels') return;
    const next = new URLSearchParams(params);
    if (typeof value === 'object') next.set('label', value.id);
    else next.delete('label');
    setParams(next);
  };
  return (
    <>
      <SettingTitle
        title={title}
        description={kind==='labels'?undefined:description}
        action={kind==='labels'
          ? <Action primary onClick={() => {setInlineName('');setInlineDescription('');setLocalForm(true)}}>New label</Action>
          : <AddButton onClick={() => setForm(true)}>New {title.toLowerCase().replace(/ies$/, "y").replace(/s$/, "")}</AddButton>}
      />
      {kind==='labels'&&<div className="label-settings-toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Filter by name…"/><select className="input" aria-label="Label scope" value={scope} onChange={event=>{const value=event.target.value;setScope(value);setArchived(value==='archived')}}><option value="all">Workspace and all teams</option><option value="workspace">Workspace</option>{data.teams.filter(team=>!team.deletedAt).map(team=><option key={team.id} value={team.id}>{team.name}</option>)}<option value="archived">Archived</option></select></div>}
      {kind==='labels'&&<LabelGroups scope={scope} query={query} entityType={initial.entityType||'issues'}/>}
      {kind==='labels'&&<LabelBulk labels={selectedLabels} onClear={()=>setSelected(new Set())} context={context} onCloseContext={()=>setContext(null)}/>}
      {kind==='labels'&&(shown.length>0||creatingLabel)&&<div className="label-table-head"><button type="button">Name ↓</button><button type="button">Description</button><button type="button">Issues</button><button type="button">Last applied</button><button type="button">Created</button></div>}
      {creatingLabel&&<form className="label-new-row" aria-label="New label" onSubmit={async event=>{event.preventDefault();const name=inlineName.trim();if(!name)return;await act(()=>create('labels',{...initial,name,description:inlineDescription.trim(),color:'#26b5ce',teamId:scope==='workspace'||scope==='all'?null:scope}));closeInlineLabel();setInlineName('');setInlineDescription('')}}><span className="label-new-color"/><input autoFocus aria-label="Label name" placeholder="Label name" value={inlineName} onChange={event=>setInlineName(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();closeInlineLabel()}}}/><input aria-label="Label description" placeholder="Add label description…" disabled={!inlineName.trim()} value={inlineDescription} onChange={event=>setInlineDescription(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();closeInlineLabel()}}}/><button className="label-inline-submit" type="submit" tabIndex={-1}>Create label</button></form>}
      <div className="feature-settings-card">
        {shown.map((x) => (
          <div className="feature-settings-row" key={x.id} data-label-id={kind==='labels'?x.id:undefined} data-selected={selected.has(x.id)} tabIndex={kind==='labels'?0:undefined} onKeyDown={event=>{if(kind==='labels'&&event.target===event.currentTarget&&event.key.toLowerCase()==='x'){event.preventDefault();event.stopPropagation();toggle(x.id,event.shiftKey)}}} onClick={event=>{if(kind==='labels'&&event.shiftKey&&!(event.target as HTMLElement).closest('button,input,select')){event.preventDefault();toggle(x.id,true)}}} onContextMenu={event=>{if(kind!=='labels')return;event.preventDefault();if(!selected.has(x.id))setSelected(new Set([x.id]));setContext({x:event.clientX,y:event.clientY})}}>
            {kind==='labels'&&<input type="checkbox" aria-label={'Select '+x.name} checked={selected.has(x.id)} onChange={()=>{}} onClick={event=>toggle(x.id,event.shiftKey)}/>}
            {kind==='labels'?<><LabelInline label={x}/><span className="label-scope">{data.teams.find(team=>team.id===x.teamId)?.name||'Workspace'}{x.archivedAt?' · Archived':''}</span><span className="label-usage">{usage.get(x.id)?.count||0} {x.entityType==='projects'?((usage.get(x.id)?.count||0)===1?'project':'projects'):x.entityType==='initiatives'?((usage.get(x.id)?.count||0)===1?'initiative':'initiatives'):((usage.get(x.id)?.count||0)===1?'issue':'issues')}</span><div className="label-usage-details"><span className="label-last-applied" title={usage.get(x.id)?.lastApplied||'No known application event'}>Last applied: {usage.get(x.id)?.lastApplied?date(usage.get(x.id)!.lastApplied):'Unknown'}</span><span className="label-rule-usage" title={(usage.get(x.id)?.slaRules||[]).map(rule=>rule.name).join(', ')}>{usage.get(x.id)?.slaRules.length||0} SLA {(usage.get(x.id)?.slaRules.length||0)===1?'rule':'rules'}</span><span className="label-rule-usage" title={(usage.get(x.id)?.triageRules||[]).map(rule=>rule.name).join(', ')}>{usage.get(x.id)?.triageRules.length||0} triage {(usage.get(x.id)?.triageRules.length||0)===1?'rule':'rules'}</span></div></>:<div>
              <strong>{x.name || x.title}</strong>
              {subtitle && <p>{subtitle(x)}</p>}
            </div>}
            {kind!=='labels'&&x.color && (
              <span
                className="feature-team-dot"
                style={{ background: x.color }}
              />
            )}
            <Action onClick={() => setForm(x)}>Edit</Action>
            <EntityMenu kind={kind} item={x} />
          </div>
        ))}
      </div>
      {kind==='labels'&&!shown.length&&!creatingLabel&&<div className="label-empty" role="status"><svg viewBox="0 0 120 80" aria-hidden="true"><ellipse className="label-empty-orbit" cx="60" cy="40" rx="52" ry="31" transform="rotate(18 60 40)"/><ellipse cx="45" cy="29" rx="11" ry="8"/><ellipse cx="75" cy="35" rx="11" ry="8"/><ellipse cx="42" cy="49" rx="11" ry="8"/><ellipse cx="70" cy="56" rx="11" ry="8"/></svg><span>No labels found</span></div>}
      {kind!=='labels'&&!items.length && (
        <Blank
          title={`No ${title.toLowerCase()} yet`}
          action={
            <AddButton onClick={() => setForm(true)}>
              Create{" "}
              {title.toLowerCase().replace(/ies$/, "y").replace(/s$/, "")}
            </AddButton>
          }
        />
      )}{" "}
      {linkedId && !initialSyncing && !linkedItem && <p role="status">Label not found</p>}
      {form && (
        <FormDialog
          key={typeof form === 'object' ? form.id : 'new'}
          title={
            typeof form === "object"
              ? `Edit ${title.toLowerCase().replace(/ies$/, "y").replace(/s$/, "")}`
              : `New ${title.toLowerCase().replace(/ies$/, "y").replace(/s$/, "")}`
          }
          fields={fields}
          initial={typeof form === "object" ? form : initial}
          submit={typeof form === "object" ? "Save changes" : "Create"}
          onClose={() => setForm(false)}
          onSave={(v) =>
            act(() =>
              typeof form === "object"
                ? update(kind, form.id, v)
                : create(kind, { ...initial, ...v }),
            )
          }
        />
      )}
    </>
  );
}
function Labels({entityType='issues',teamId}:{entityType?:string;teamId?:string}) {
  const { data } = useActions();
  return (
    <div className="settings-label-page"><Collection
      title={entityType==='projects'?"Project labels":entityType==='initiatives'?"Initiative labels":"Issue labels"}
      kind="labels"
      filter={label=>(label.entityType||'issues')===entityType&&(!teamId||label.teamId===teamId)}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "description", label: "Description" },
        { key: "color", label: "Color", placeholder: "#7775df" },
        {
          key: "teamId",
          label: "Team",
          type: "select",
          options: optionList(data.teams, "Workspace"),
        },
        { key: "group", label: "Label group" },
        {
          key: "entityType",
          label: "Use for",
          type: "select",
          options: [
            { value: "issues", label: "Issues" },
            { value: "projects", label: "Projects" },
            { value: "initiatives", label: "Initiatives" },
          ],
        },
      ]}
      initial={{ color: "#7775df", entityType, ...(teamId?{teamId}:{}) }}
      initialScope={teamId||"workspace"}
      subtitle={(x) => x.description || x.group || "Workspace label"}
    /></div>
  );
}

function Workflows({ teamId }: { teamId: string }) {
  return <>
    <WorkflowStatuses key={teamId} teamId={teamId}/>
    <WorkflowAutomationSettings teamId={teamId}/>
    <RoutingRules teamId={teamId}/>
  </>;
}
function RoutingRules({teamId}:{teamId:string}){return <TriageRules teamId={teamId}/>}

function Slas() {
  return <SlaSettings />;
}
type IntegrationProvider={name:string;description:string;slug:string;icon?:string;preinstalled?:boolean};
const integrationProvider=(name:string,description:string,slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),icon?:string,preinstalled=false):IntegrationProvider=>({name,description,slug,icon,preinstalled});
const integrationCategories:{name:string;providers:IntegrationProvider[]}[]=[
  {name:"Essentials",providers:[
    integrationProvider("GitHub","Connect GitHub to automate PR workflows, review code in Parabolic, sync issues and understand your codebase","github","github"),
    integrationProvider("Slack","Create issues from Slack messages and sync threads","slack","slack"),
    integrationProvider("GitLab","Automate your Merge Request workflow","gitlab","gitlab"),
    integrationProvider("Figma","Create and link issues directly from Figma","figma","figma"),
    integrationProvider("Intercom","Keep a tight feedback loop with customers and streamline bug reports","intercom","intercom"),
    integrationProvider("Google Sheets","Build custom dashboards and analytics from issue and project data","google-sheets","googlesheets"),
  ]},
  {name:"AI clients",providers:[
    integrationProvider("Cursor MCP","Connect Cursor to the Parabolic MCP server","cursor-mcp","cursor"),
    integrationProvider("ChatGPT","Connect ChatGPT deep research to Parabolic","chatgpt","openai"),
    integrationProvider("Claude","Connect Claude to the Parabolic MCP server","claude","anthropic"),
    integrationProvider("v0 by Vercel MCP connector","Connect v0 and Parabolic through MCP","v0","v0"),
    integrationProvider("Windsurf","Connect Windsurf to the Parabolic MCP server"),
    integrationProvider("Replit","Build apps and automations","replit","replit"),
  ]},
  {name:"Engineering",providers:[
    integrationProvider("GitHub","Connect GitHub to automate PR workflows, review code in Parabolic, sync issues and understand your codebase","github","github"),
    integrationProvider("GitLab","Automate your Merge Request workflow","gitlab","gitlab"),
    integrationProvider("PagerDuty Triage Responsibility","Automate the rotation of triage responsibility with PagerDuty schedules","pagerduty"),
    integrationProvider("Sentry","Create and link issues with Sentry and automate issue creation","sentry","sentry"),
    integrationProvider("VS Code","Easily build VS Code extensions with Parabolic Connect","vs-code","visualstudiocode"),
    integrationProvider("Datadog","Create Parabolic issues from Datadog Cases and Monitors","datadog","datadog"),
    integrationProvider("incident.io","Manage incidents and triage responsibility directly in Parabolic","incident-io"),
    integrationProvider("Raycast","Create, search, and modify your issues from anywhere","raycast","raycast"),
  ]},
  {name:"Parabolic crafted",providers:[
    integrationProvider("GitHub","Connect GitHub to automate PR workflows, review code in Parabolic, sync issues and understand your codebase","github","github"),
    integrationProvider("Slack","Create issues from Slack messages and sync threads","slack","slack"),
    integrationProvider("GitLab","Automate your Merge Request workflow","gitlab","gitlab"),
    integrationProvider("Figma","Create and link issues directly from Figma","figma","figma"),
    integrationProvider("Parabolic Asks for Slack","Turn requests from Slack or email into actionable issues and enable helpdesk workflows","parabolic-asks"),
    integrationProvider("Notion","Previews of Parabolic issues, views and projects and query Notion AI","notion","notion"),
    integrationProvider("PagerDuty Triage Responsibility","Automate the rotation of triage responsibility with PagerDuty schedules","pagerduty"),
    integrationProvider("Zapier","Build custom automations to create or update Parabolic issues","zapier","zapier"),
  ]},
  {name:"Bug Reporting",providers:[
    integrationProvider("Parabolic Asks for Slack","Turn requests from Slack or email into actionable issues and enable helpdesk workflows","parabolic-asks"),
    integrationProvider("Sentry","Create and link issues with Sentry and automate issue creation","sentry","sentry"),
    integrationProvider("incident.io","Manage incidents and triage responsibility directly in Parabolic","incident-io"),
    integrationProvider("Bird Eats Bug","Speed up your bug reporting workflow","bird-eats-bug"),
    integrationProvider("Honeybadger","Manage Honeybadger errors via Parabolic issues","honeybadger"),
    integrationProvider("Jam","Create Parabolic issues with all the details developers need to resolve bugs faster","jam"),
    integrationProvider("Vercel","Turn Vercel Preview Deployment comments into action items","vercel"),
    integrationProvider("Arc","Create new issues right from your browser command bar","arc",undefined,true),
  ]},
  {name:"Automations",providers:[
    integrationProvider("Zapier","Build custom automations to create or update Parabolic issues","zapier","zapier"),
    integrationProvider("Create issues via email","Set up email addresses for teams or templates to create issues via email","create-issues-email",undefined,true),
    integrationProvider("Jira","Smoothly transition from Jira to Parabolic","jira","jira"),
    integrationProvider("Raycast","Create, search, and modify your issues from anywhere","raycast","raycast"),
    integrationProvider("Fivetran","Sync your Parabolic data with the Fivetran connector","fivetran"),
    integrationProvider("Fillout","Create Parabolic issues from a customizable intake form","fillout"),
    integrationProvider("Supernormal","Go from discussion to Parabolic issues in seconds","supernormal"),
    integrationProvider("Tactiq","Automatically create detailed Parabolic issues from meeting transcripts","tactiq"),
  ]},
  {name:"Customer Experience",providers:[
    integrationProvider("Zendesk","Keep a tight feedback loop with customers and streamline bug reports","zendesk","zendesk"),
    integrationProvider("Intercom","Keep a tight feedback loop with customers and streamline bug reports","intercom","intercom"),
    integrationProvider("Front","Keep a tight feedback loop with customers and streamline bug reports","front"),
    integrationProvider("Salesforce","Create Parabolic issues from Salesforce cases","salesforce","salesforce"),
    integrationProvider("Attio","Add customer requests and issues, plus sync customer details, directly from Attio","attio"),
    integrationProvider("Gong","Automatically create customer requests from Gong calls","gong"),
    integrationProvider("Productlane","Helpdesk, customer requests portal, public roadmap, and changelog built on Parabolic","productlane"),
    integrationProvider("Arkweaver","Message the right customers and teammates when Parabolic Projects go live","arkweaver"),
  ]},
  {name:"Collaboration",providers:[
    integrationProvider("Slack","Create issues from Slack messages and sync threads","slack","slack"),
    integrationProvider("Parabolic Asks for Slack","Turn requests from Slack or email into actionable issues and enable helpdesk workflows","parabolic-asks"),
    integrationProvider("Notion","Previews of Parabolic issues, views and projects and query Notion AI","notion","notion"),
    integrationProvider("Discord","Create issues, share updates, and keep everyone in sync","discord","discord"),
    integrationProvider("Glean","Search Parabolic for instant insights","glean"),
    integrationProvider("Attio","Add customer requests and issues, plus sync customer details, directly from Attio","attio"),
    integrationProvider("Productlane","Helpdesk, customer requests portal, public roadmap, and changelog built on Parabolic","productlane"),
    integrationProvider("Range","Pull Parabolic issues into async check-ins","range"),
  ]},
  {name:"Media & Design",providers:[
    integrationProvider("Figma","Create and link issues directly from Figma","figma","figma"),
    integrationProvider("Descript","Embed Descript share URLs in Parabolic issues and documents","descript",undefined,true),
    integrationProvider("Miro","Import, create and manage issues directly in Miro","miro","miro"),
    integrationProvider("YouTube","Embed YouTube videos in Parabolic issues and documents","youtube","youtube",true),
    integrationProvider("Loom","Embed Loom videos in Parabolic issues and documents","loom","loom",true),
    integrationProvider("Tella","Embed Tella videos in Parabolic","tella"),
    integrationProvider("Claap","Record bugs and directly create issues in Parabolic","claap"),
    integrationProvider("Canva AI Connector","Create and link Parabolic workflow content directly within Canva","canva","canva"),
    integrationProvider("Screenpresso","Report an issue with embedded screenshots and videos","screenpresso"),
  ]},
  {name:"Analytics",providers:[
    integrationProvider("Airbyte","Connect Parabolic to Airbyte and consolidate data in warehouses, lakes, and databases","airbyte","airbyte"),
    integrationProvider("Google Sheets","Build custom dashboards and analytics from issue and project data","google-sheets","googlesheets"),
    integrationProvider("Fivetran","Sync your Parabolic data with the Fivetran connector","fivetran"),
    integrationProvider("Retool","Create, update, and analyze Parabolic issues in custom internal tools","retool","retool"),
    integrationProvider("Span","See how work translates into engineering impact","span"),
    integrationProvider("Jellyfish","Developer productivity insights and AI impact signals in one dashboard","jellyfish"),
    integrationProvider("Basedash","Ask questions and build dashboards from your Parabolic data","basedash"),
    integrationProvider("Cycle Report","Create reports of your cycles that clients can review and sign off on","cycle-report"),
  ]},
  {name:"Security & Compliance",providers:[
    integrationProvider("Fencer","Create and link issues directly from Fencer","fencer"),
    integrationProvider("SecureSlate","Create and link SecureSlate security tickets to Parabolic","secureslate"),
    integrationProvider("Vanta","Automate compliance, simplify security, and demonstrate trust","vanta"),
    integrationProvider("Kawach AI","Keep your workspace compliant with organization policies","kawach-ai"),
    integrationProvider("Drata","Simplify risk and managing frameworks like SOC 2 and ISO 27001","drata"),
    integrationProvider("Orca Security","Share relevant security context with the right people","orca-security"),
    integrationProvider("SimpleBackups","Never lose an issue, project, or cycle","simplebackups"),
    integrationProvider("Aikido Security","Put your application security on autopilot","aikido-security"),
  ]},
];
const allIntegrationProviders=[...new Map(integrationCategories.flatMap(category=>category.providers).map(provider=>[provider.slug,provider])).values()];
function IntegrationBrand({provider}:{provider:IntegrationProvider}){return <span className={`integration-brand ${provider.slug}`}>{provider.icon?<img src={`/integrations/${provider.icon}.svg`} alt=""/>:<span>{provider.name[0]}</span>}</span>}
function IntegrationDetail({provider}:{provider:IntegrationProvider}){return <div className="integration-detail-page">
  <Link className="integration-detail-back" to="/settings/integrations">‹ <span>Integrations</span></Link>
  <header><IntegrationBrand provider={provider}/><span><h1>{provider.name}</h1><p>{provider.description}</p></span></header>
  <section className="integration-detail-overview"><div className="integration-detail-meta"><span><small>BUILT BY</small><strong>▣ Parabolic</strong></span><span><small>DOCS</small><strong>▰ Docs</strong></span><button disabled><Plug size={14}/> Enable</button></div><div className="integration-detail-preview"><span/><span/></div><h2>Overview</h2><p>{provider.name} connects your workflow with Parabolic. This internal scaffold preserves the catalog, settings route, and configuration layout while authorization and synchronization remain deferred.</p><a>Read more</a></section>
  <section className="integration-detail-section"><h2>Connections</h2><button disabled>Connect organization</button><div>No organizations connected</div></section>
  <section className="integration-detail-section muted"><h2>Configuration</h2><p>Connection settings become available after this integration is enabled.</p></section>
 </div>}
function Integrations({providerSlug}:{providerSlug?:string}) {
  const navigate=useNavigate(),[query,setQuery]=useState("");
  const selected=providerSlug?allIntegrationProviders.find(provider=>provider.slug===providerSlug):undefined;
  if(providerSlug)return selected?<IntegrationDetail provider={selected}/>:<Navigate to="/settings/integrations" replace/>;
  const open=(provider:IntegrationProvider)=>navigate(`/settings/integrations/${provider.slug}`);
  return (
    <div className="integration-settings-page">
      <SettingTitle
        title="Integrations"
        description="Enhance your Parabolic experience with a wide variety of add-ons and integrations"
      />
      <SearchBox value={query} onChange={setQuery} placeholder="Search integrations"/>
      {!query&&<><button className="integration-featured" onClick={()=>open(allIntegrationProviders.find(provider=>provider.slug==='slack')!)}><span className="integration-featured-badge">ESSENTIALS</span><span className="integration-featured-art"><b><i>▣</i>Create a new issue</b><label>Team<i/></label><label>Title<i/></label><label>Description (optional)<i className="large"/></label></span><span className="integration-featured-copy"><IntegrationBrand provider={allIntegrationProviders.find(provider=>provider.slug==='slack')!}/><span><strong>Slack</strong><small>Create issues from Slack messages and sync threads</small></span></span></button><nav className="integration-featured-tabs"><button onClick={()=>open(allIntegrationProviders.find(provider=>provider.slug==='parabolic-asks')!)}>◒ Parabolic Asks for Slack</button><button className="active" onClick={()=>open(allIntegrationProviders.find(provider=>provider.slug==='slack')!)}>✣ Slack</button><button onClick={()=>open(allIntegrationProviders.find(provider=>provider.slug==='github')!)}>◉ GitHub</button><button onClick={()=>open(allIntegrationProviders.find(provider=>provider.slug==='figma')!)}>⌘ Figma</button></nav></>}
      {integrationCategories.map(category=>{
        const normalized=query.trim().toLowerCase(),visible=category.providers.filter(provider=>!normalized||`${provider.name} ${provider.description}`.toLowerCase().includes(normalized));
        return visible.length?<section className="integration-category" key={category.name}><h2>{category.name}</h2><div className="feature-provider-grid">
        {visible.map(provider => {
          return (
            <button
              key={`${category.name}-${provider.slug}`}
              className="feature-provider-card"
              onClick={() => open(provider)}
            >
              <span className="integration-card-title"><IntegrationBrand provider={provider}/><strong>{provider.name}</strong></span>
              <span>{provider.preinstalled&&<em>Pre-installed</em>}{provider.description}</span>
            </button>
          );
        })}
      </div></section>:null})}
    </div>
  );
}
function AsksSettings() {
  return (
    <div className="asks-settings-page">
      <SettingTitle
        title="Asks"
        description={<>
          Let anyone submit bug reports, feature requests, and more using structured templates from Slack or email.{' '}
          <a href="https://parabolic.app/docs/parabolic-asks" target="_blank" rel="noreferrer">Docs ↗</a>
        </>}
      />
      <AsksPagesSettings/>
      <AsksRequesters/>
      <SettingSection title="Request intake" description="Manage the channels people use to submit requests.">
        <SettingRow
          title="Web forms"
          description="Create forms that route requests directly to teams."
        >
          <Link className="button feature-button" to="/asks">
            Manage forms
          </Link>
        </SettingRow>
        <SettingRow
          title="External channels"
          description="Slack and email channel setup will be available from integrations."
        >
          <Link className="button feature-button" to="/settings/integrations">
            Integration settings
          </Link>
        </SettingRow>
      </SettingSection>
    </div>
  );
}

async function api(path: string, init?: RequestInit) {
  const r = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await r.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  if (!r.ok)
    throw Error(
      body?.error?.message || body?.message || `Request failed (${r.status})`,
    );
  return body;
}
function Security() {
  const { toast, logout } = useActions();
  const [change, setChange] = useState(false),
    [sessions, setSessions] = useState<any[]>([]),
    [error, setError] = useState("");
  const load = () =>
    api("/auth/sessions")
      .then((r) => setSessions(r.nodes || r.sessions || r))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <SettingTitle title="Security & access" />
      <SettingSection title="Sessions" description="Devices logged into your account">
        {error?<p className="feature-error">{error}</p>:sessions.filter(s=>s.current).map(s=><div className="settings-session-row current" key={s.id}><span className="settings-notification-icon"><Monitor size={15}/></span><div><strong>Parabolic Desktop on macOS</strong><p><i/> Current session · Local workspace</p></div><Action onClick={async()=>{await logout();location.assign('/login')}}>Log out</Action></div>)}
      </SettingSection>
      {!!sessions.filter(s=>!s.current).length&&<section className="feature-setting-section settings-other-sessions"><div className="feature-settings-card"><div className="settings-session-header"><span>{sessions.filter(s=>!s.current).length} other {sessions.filter(s=>!s.current).length===1?'session':'sessions'}</span><Action onClick={async()=>{for(const s of sessions.filter(s=>!s.current))await api(`/auth/sessions/${s.id}`,{method:'DELETE'});await load();toast('Other sessions revoked')}}>Revoke all</Action></div>{sessions.filter(s=>!s.current).map(s=><div className="settings-session-row" key={s.id}><span className="settings-notification-icon"><Monitor size={15}/></span><div><strong>Parabolic on macOS</strong><p>Created {date(s.createdAt||s.created_at)} · Expires {date(s.expiresAt||s.expires_at)}</p></div><Action onClick={async()=>{await api(`/auth/sessions/${s.id}`,{method:'DELETE'});await load()}}>Revoke</Action></div>)}</div></section>}
      <SettingSection title="Authorized applications" description="OAuth applications you've approved"><div className="feature-settings-card settings-authorized-empty">No applications have been authorized to connect with your account.</div></SettingSection>
      <SettingSection title="Password"><SettingRow title="Password" description="Use a strong password to protect your account"><Action onClick={()=>setChange(true)}>Change password</Action></SettingRow></SettingSection>
      {change && (
        <FormDialog
          title="Change password"
          fields={[
            {
              key: "currentPassword",
              label: "Current password",
              type: "password",
              required: true,
            },
            {
              key: "newPassword",
              label: "New password (at least 10 characters)",
              type: "password",
              required: true,
            },
            {
              key: "confirmPassword",
              label: "Confirm new password",
              type: "password",
              required: true,
            },
          ]}
          submit="Update password"
          onClose={() => setChange(false)}
          onSave={async (v) => {
            if (v.newPassword !== v.confirmPassword)
              throw Error("The new passwords do not match.");
            if (v.newPassword.length < 10)
              throw Error("Use at least 10 characters.");
            await api("/auth/password", {
              method: "POST",
              body: JSON.stringify(v),
            });
            await load();
            toast("Password changed. Other sessions have been signed out.");
            return true;
          }}
        />
      )}
    </>
  );
}
function ConnectedAccounts(){
 const [provider,setProvider]=useState('');
 const rows=[['Slack','Sync your message attribution, and receive notifications in Slack','slack'],['Google Calendar','Sync your calendar out-of-office status to Parabolic','calendar'],['Notion','Preview issues, projects, and views within Notion','notion'],['GitHub','Sync attribution of your commits, pull requests, and comments','github']];
 const icon=(kind:string)=>kind==='slack'?<svg viewBox="0 0 122.8 122.8"><path fill="#36C5F0" d="M30.3 77.5a15.1 15.1 0 1 1-15.1-15.1h15.1v15.1Zm7.6 0a15.1 15.1 0 0 1 30.2 0v37.8a15.1 15.1 0 0 1-30.2 0V77.5Z"/><path fill="#2EB67D" d="M45.4 30.3a15.1 15.1 0 1 1 15.1-15.1v15.1H45.4Zm0 7.6a15.1 15.1 0 0 1 0 30.2H7.6a15.1 15.1 0 0 1 0-30.2h37.8Z"/><path fill="#ECB22E" d="M92.5 45.4a15.1 15.1 0 1 1 15.1 15.1H92.5V45.4Zm-7.6 0a15.1 15.1 0 0 1-30.2 0V7.6a15.1 15.1 0 0 1 30.2 0v37.8Z"/><path fill="#E01E5A" d="M77.5 92.5a15.1 15.1 0 1 1-15.1 15.1V92.5h15.1Zm0-7.6a15.1 15.1 0 0 1 0-30.2h37.8a15.1 15.1 0 0 1 0 30.2H77.5Z"/></svg>:kind==='calendar'?<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M4 5h16v15H4z"/><path fill="#fff" d="M7 9h10v8H7z"/><path fill="#34A853" d="M4 5h16v4H4z"/><path fill="#FBBC04" d="M4 9h3v8H4z"/><path fill="#EA4335" d="M7 4h10v5H7z"/><path fill="#4285F4" d="M14.8 11.2h-2.3v1.5h1.1c-.1 1-.8 1.6-1.7 1.6-1.1 0-2-.9-2-2.1s.9-2.1 2-2.1c.6 0 1 .2 1.4.5l1-1a3.4 3.4 0 0 0-2.4-.9 3.5 3.5 0 1 0 0 7c2 0 3.1-1.4 3.1-3.3 0-.4-.1-.8-.2-1.2z"/></svg>:kind==='github'?<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.61-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 7.7a9.5 9.5 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>:<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4.5 3.5 16 2.7l3.5 2.8v15l-11.8.8-3.2-2.6V3.5Zm3.2 1.8v13.5l9.8-.6V6.1L7.7 5.3Zm1.6 2.2 2-.2 4.5 6.8V7l1.4-.1v9.5l-1.9.2-4.6-7v7.3l-1.4.1V7.5Z"/></svg>;
 return <div className="connected-accounts-page"><SettingTitle title="Connected accounts" description="Connect your user accounts to sync attribution of your actions between apps"/><div className="settings-connected-list">{rows.map(([name,description,kind])=><div className="settings-connected-card" key={name}><span aria-hidden="true" className={`settings-connected-icon ${kind}`}>{icon(kind)}</span><div><strong>{name}</strong><p>{description}</p></div><button type="button" aria-label={`Connect ${name}`} onClick={()=>setProvider(name)}>Connect <ArrowUpRight size={13}/></button></div>)}</div>{provider&&<FormDialog title={`Connect ${provider}`} fields={[]} submit="Done" onClose={()=>setProvider('')} onSave={async()=>true}><p className="muted">Connector authorization will be available when the {provider} integration is enabled.</p></FormDialog>}</div>;
}
function WorkspaceSecurity(){
 const {data,update,act}=useActions(),workspace=data.workspaces.find(item=>item.id===data.workspaceId);if(!workspace)return null;
 const patch=(field:string,value:any)=>act(()=>update('workspaces',workspace.id,{[field]:value}));
 const policies=[{value:'members',label:'All members'},{value:'admins',label:'Only admins'}];
 return <div className="workspace-security-page"><SettingTitle title="Security"/><h3 className="settings-security-group-title">Workspace access</h3><WorkspaceInviteLink native/><ApprovedDomains native/>
  <SettingSection className="security-authentication-section" title="Authentication methods" description="Admins and guests can always authenticate via Google and email/password — even when disabled for members"><SettingRow title="Google authentication" description="When enabled, this is available to all workspace members and guests"><Toggle label="Google authentication" value={workspace.googleAuthentication!==false} onChange={value=>patch('googleAuthentication',value)}/></SettingRow><SettingRow title="Email & password authentication" description="When enabled, this is available to all workspace members and guests"><Toggle label="Email authentication" value={workspace.emailAuthentication!==false} onChange={value=>patch('emailAuthentication',value)}/></SettingRow></SettingSection>
  <SettingSection title="Workspace management"><SettingRow id="new-user-invitations" title="New user invitations" description="Who can invite new members to the workspace"><PreferenceSelect label="New user invitations" value={workspace.allowMemberInvites===true?'members':'admins'} values={policies} onChange={value=>patch('allowMemberInvites',value==='members')}/></SettingRow><SettingRow id="team-creation" title="Team creation" description="Who can create new teams"><PreferenceSelect label="Team creation" value={workspace.teamCreationPolicy||'members'} values={policies} onChange={value=>patch('teamCreationPolicy',value)}/></SettingRow><SettingRow title="Workspace initiatives" description="Who can create workspace level initiatives"><PreferenceSelect label="Workspace initiatives" value={workspace.initiativeCreationPolicy||'admins'} values={policies} onChange={value=>patch('initiativeCreationPolicy',value)}/></SettingRow><SettingRow title="Manage workspace labels" description="Who can create, update, and delete workspace labels"><PreferenceSelect label="Manage workspace labels" value={workspace.labelManagementPolicy||'admins'} values={policies} onChange={value=>patch('labelManagementPolicy',value)}/></SettingRow><SettingRow title="Manage workspace templates" description="Who can manage workspace templates"><PreferenceSelect label="Manage workspace templates" value={workspace.templateManagementPolicy||'admins'} values={policies} onChange={value=>patch('templateManagementPolicy',value)}/></SettingRow></SettingSection>
  <SettingSection title="File uploads" description="Restrict the file types users are allowed to uploads. Image and video files are always allowed."><SettingRow id="restrict-file-uploads" title="Restrict file uploads"><Toggle label="Restrict file uploads" value={!!workspace.restrictFileUploads} onChange={value=>patch('restrictFileUploads',value)}/></SettingRow></SettingSection>
  <SettingSection title="Integrations & applications"><SettingRow title="Review third-party applications" description="Control which applications can be installed to your workspace"><Link className="settings-priority-link" to="/settings/applications">Review <span>›</span></Link></SettingRow><SettingRow id="support-integration-privacy" title="Reduce personal information from support integrations" description="Personal information from support integrations won’t be stored"><Toggle label="Reduce personal information from support integrations" value={!!workspace.reduceSupportIntegrationPersonalInformation} onChange={value=>patch('reduceSupportIntegrationPersonalInformation',value)}/></SettingRow></SettingSection>
  <SettingSection title="Compliance"><SettingRow id="hipaa-compliance" title="HIPAA compliance" description="Enable privacy and security measures to ensure that Protected Health Information (PHI) is appropriately safeguarded"><Toggle label="HIPAA compliance" value={!!workspace.hipaaCompliance} onChange={value=>patch('hipaaCompliance',value)}/></SettingRow></SettingSection>
 </div>;
}
function Mcp() {
  const {toast}=useActions();
  return (
    <>
      <SettingTitle
        title="MCP access"
        description="Connect external tools to this workspace using the Model Context Protocol."
      />
      <SettingSection title="Authentication">
        <SettingRow title="Remote MCP server" description="Paste this URL into an MCP client. Sign in and approve the requested access using OAuth.">
          <input className="input" aria-label="Remote MCP URL" readOnly value={`${location.origin}/mcp`}/>
          <Action onClick={async()=>{await navigator.clipboard.writeText(`${location.origin}/mcp`);toast('MCP URL copied')}}>Copy URL</Action>
        </SettingRow>
        <SettingRow
          title="Scoped API key"
          description="Use a dedicated key with only the permissions your client needs"
        >
          <Link className="button feature-button" to="/settings/api">
            Manage API keys
          </Link>
        </SettingRow>
      </SettingSection>
      <section className="feature-setting-section">
        <h3>Local client configuration</h3>
        <pre className="feature-code">
          {JSON.stringify(
            {
              mcpServers: {
                workspace: {
                  command: "node",
                  args: ["dist-mcp/cli.mjs"],
                  env: {
                    PARABOLIC_URL: location.origin,
                    PARABOLIC_API_TOKEN: "YOUR_SCOPED_API_KEY",
                  },
                },
              },
            },
            null,
            2,
          )}
        </pre>
        <p className="muted">
          The server exposes workspace entities and mutations to authenticated
          external clients. Hosted AI sessions are not part of this workspace.
        </p>
      </section>
    </>
  );
}

function DeveloperSettings({ section }: { section: string }) {
  const { toast,data } = useActions();
  const [items, setItems] = useState<any[]>([]),
    [error, setError] = useState(""),
    [form, setForm] = useState<any>(false),
    [secret, setSecret] = useState<any>(null),
    [deleting, setDeleting] = useState<any>(null),
    [rotating, setRotating] = useState<any>(null),
    [deliveries, setDeliveries] = useState<any>(null);
  const title =
    section === "api"
      ? "API keys"
      : section === "webhooks"
        ? "Webhooks"
        : "Applications";
  const base =
    section === "api"
      ? "/api/v1/api-keys"
      : section === "webhooks"
        ? "/api/v1/webhooks"
        : "/api/v1/apps";
  const load = async () => {
    try {
      const r = await api(base);
      setItems(r.nodes || r.items || r);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, [base]);
  const fields: FormField[] =
    section === "api"
      ? [
          { key: "name", label: "Name", required: true },
          {
            key: "scopes",
            label: "Permissions",
            placeholder: "read or issues:read,issues:write",
          },
          { key: "expiresAt", label: "Expiration date", type: "date" },
        ]
      : section === "webhooks"
        ? [
            { key: "url", label: "Endpoint URL", required: true },
            {
              key: "events",
              label: "Events (comma-separated)",
              required: true,
              placeholder: "issues.create, issues.update",
            },
            { key: "enabled", label: "Enabled", type: "checkbox" },
            {key:'teamScope',label:'Team scope',type:'select',options:[{value:'',label:'All authorized teams'},{value:'public',label:'All public teams'},...data.teams.filter(team=>!team.deletedAt&&!team.archivedAt).map(team=>({value:team.id,label:team.name}))]},
          ]
        : [
            { key: "name", label: "Application name", required: true },
            {
              key: "redirectUris",
              label: "Redirect URLs (one per line)",
              required: true,
              type: "textarea",
            },
            {
              key: "scopes",
              label: "Permissions",
              placeholder: "read or issues:read,issues:write",
            },
          ];
  if(section==='applications') {const authorized=items.filter(item=>item.appUserId);return <div className="applications-settings-page">
    <SettingTitle title="Applications" description={<>Manage which third-party applications have access to your workspace. <a href="https://parabolic.app/docs/third-party-application-approvals" target="_blank" rel="noreferrer">Docs ↗</a></>}/>
    <div className="feature-settings-card applications-authorized-card">{authorized.length?authorized.map(item=><SettingRow key={item.id} title={item.name} description={Array.isArray(item.scopes)?item.scopes.join(', '):'Authorized application'}><Action onClick={()=>setDeleting(item)}>Revoke</Action></SettingRow>):<p>Your workspace has not yet authorized any external applications to connect with your Parabolic account</p>}</div>
    <div className={`applications-legacy-admin${new URLSearchParams(location.search).get('manage')==='1'?' active':''}`}><Action onClick={()=>setForm(true)}>New application</Action>{items.map(item=><div key={item.id}><Action onClick={()=>setForm(item)}>Edit</Action><Action onClick={()=>setRotating(item)}>Rotate secret</Action></div>)}</div>
    {rotating&&<Confirm title="Rotate application secret?" description="All existing access tokens, refresh tokens, and pending authorization codes for this application will be revoked. Save the new secret for your application." onClose={()=>setRotating(null)} onConfirm={async()=>{const result=await api(`${base}/${rotating.id}/rotate-secret`,{method:'POST'});setSecret(result);setRotating(null);return result;}}/>}
    {form&&<ApplicationForm application={typeof form==='object'?form:undefined} onClose={()=>setForm(false)} onSave={async fields=>{const result=await api(typeof form==='object'?`${base}/${form.id}`:base,{method:typeof form==='object'?'PATCH':'POST',body:JSON.stringify(fields)});await load();if(result.clientSecret)setSecret(result);return result;}}/>}
    {secret&&<FormDialog title="Save your credential" fields={[]} submit="Done" onClose={()=>setSecret(null)} onSave={async()=>true}><p className="muted">This credential is displayed once. Store it somewhere secure.</p>{secret.id&&<label className="feature-field"><span>ID</span><input className="input" readOnly value={secret.id}/></label>}<div className="feature-inline"><input className="input" aria-label="Credential" readOnly value={secret.token||secret.secret||secret.clientSecret}/><Action onClick={()=>navigator.clipboard.writeText(secret.token||secret.secret||secret.clientSecret)}><Copy size={14}/>Copy</Action></div></FormDialog>}
    {deleting&&<Confirm title={`Revoke ${deleting.name}?`} description="Clients using this credential will lose access immediately." onClose={()=>setDeleting(null)} onConfirm={async()=>{await api(`${base}/${deleting.id}`,{method:'DELETE'});await load();return true;}}/>}
  </div>}
  return (
    <>
      <SettingTitle
        title={title}
        description={
          section === "api"
            ? "Create scoped keys for REST, GraphQL, SDK, and MCP access."
            : section === "webhooks"
              ? "Receive signed event deliveries when workspace data changes."
              : "Register OAuth applications with explicit redirect URLs and scopes."
        }
        action={
          <AddButton onClick={() => setForm(true)}>
            New{" "}
            {section === "api"
              ? "API key"
              : section === "webhooks"
                ? "webhook"
                : "application"}
          </AddButton>
        }
      />
      {error && (
        <div className="feature-error" role="alert">
          {error}
          <Action onClick={load}>Retry</Action>
        </div>
      )}
      <div className="feature-settings-card">
        {items.map((item) => (
          <div className="feature-settings-row" key={item.id}>
            <div>
              <strong>{item.name || item.url}</strong>
              <p>
                {Array.isArray(item.scopes)
                  ? item.scopes.join(", ")
                  : Array.isArray(item.events)
                    ? item.events.join(", ")
                    : ""}
              </p>
              <p>
                {section==='webhooks'?(item.teamId?`Team: ${data.teams.find(team=>team.id===item.teamId)?.name??'Selected team'} · `:item.allPublicTeams?'All public teams · ':'All authorized teams · '):''}Created {date(item.createdAt || item.created_at)}
                {item.lastUsedAt ? ` · Last used ${date(item.lastUsedAt)}` : ""}
              </p>
            </div>
            {section !== "api" && (
              <Action onClick={() => setForm(item)}>Edit</Action>
            )}
            {section === "applications" && <Action onClick={()=>setRotating(item)}>Rotate secret</Action>}
            {section === "webhooks" && (
              <>
                <Action
                  onClick={async () => {
                    try {
                      await api(`${base}/${item.id}/test`, { method: "POST" });
                      toast("Test delivery queued");
                    } catch (e) {
                      toast((e as Error).message);
                    }
                  }}
                >
                  Send test
                </Action>
                <Toggle
                  label="Webhook enabled"
                  value={!!item.enabled}
                  onChange={async (v) => {
                    try {
                      await api(`${base}/${item.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ enabled: v }),
                      });
                      await load();
                    } catch (e) {
                      toast((e as Error).message);
                    }
                  }}
                />
                <Action
                  onClick={async () => {
                    try {
                      const r = await api(`${base}/${item.id}/deliveries`);
                      setDeliveries({
                        hook: item,
                        items: r.nodes || r.items || r,
                      });
                    } catch (e) {
                      toast((e as Error).message);
                    }
                  }}
                >
                  Deliveries
                </Action>
              </>
            )}
            <button
              className="feature-icon-button"
              aria-label={`Revoke ${item.name || "webhook"}`}
              onClick={() => setDeleting(item)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      {!items.length && !error && (
        <Blank
          icon={
            section === "api" ? (
              <KeyRound size={28} />
            ) : section === "webhooks" ? (
              <Webhook size={28} />
            ) : (
              <AppWindow size={28} />
            )
          }
          title={`No ${title.toLowerCase()} yet`}
          action={
            <AddButton onClick={() => setForm(true)}>
              Create{" "}
              {section === "api"
                ? "API key"
                : section === "webhooks"
                  ? "webhook"
                  : "application"}
            </AddButton>
          }
        />
      )}{" "}
      {section === "api" && (
        <section className="feature-setting-section">
          <h3>API endpoints</h3>
          <pre className="feature-code">{`REST     ${location.origin}/api/v1\nGraphQL  ${location.origin}/graphql\nEvents   ${location.origin}/api/v1/events`}</pre>
          <p className="muted">
            Send an Authorization: Bearer header with your key. The SDK supports
            typed queries, mutations, pagination and realtime events.
          </p>
        </section>
      )}
      {rotating&&<Confirm title="Rotate application secret?" description="All existing access tokens, refresh tokens, and pending authorization codes for this application will be revoked. Save the new secret for your application." onClose={()=>setRotating(null)} onConfirm={async()=>{const result=await api(`${base}/${rotating.id}/rotate-secret`,{method:'POST'});setSecret(result);setRotating(null);return result;}}/>}
      {form&&section==='applications'&&<ApplicationForm application={typeof form==='object'?form:undefined} onClose={()=>setForm(false)} onSave={async fields=>{const result=await api(typeof form==='object'?`${base}/${form.id}`:base,{method:typeof form==='object'?'PATCH':'POST',body:JSON.stringify(fields)});await load();if(result.clientSecret)setSecret(result);return result;}}/>}
      {form && section!=='applications' && (
        <FormDialog
          title={`${typeof form === "object" ? "Edit" : "New"} ${section === "api" ? "API key" : section === "webhooks" ? "webhook" : "application"}`}
          submit={typeof form === "object" ? "Save changes" : "Create"}
          fields={fields}
          initial={
            typeof form === "object"
              ? {
                  ...form,
                  teamScope:form.teamId??(form.allPublicTeams?'public':''),
                  scopes: form.scopes?.join(","),
                  events: form.events?.join(","),
                  redirectUris: form.redirectUris?.join("\n"),
                }
              : {
                  scopes: "read",
                  enabled: true,
                  events: "issues.create,issues.update,issues.delete",
                }
          }
          onClose={() => setForm(false)}
          onSave={async (v) => {
            const body = { ...v };
            if(section==='webhooks'){body.teamId=v.teamScope&&v.teamScope!=='public'?v.teamScope:null;body.allPublicTeams=v.teamScope==='public';delete body.teamScope;}
            if (v.scopes)
              body.scopes = v.scopes.split(",").map((s: string) => s.trim());
            if (v.events)
              body.events = v.events
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
            if (v.redirectUris)
              body.redirectUris = v.redirectUris
                .split("\n")
                .map((s: string) => s.trim())
                .filter(Boolean);
            if (!body.expiresAt) delete body.expiresAt;
            const result = await api(
              typeof form === "object" ? `${base}/${form.id}` : base,
              {
                method: typeof form === "object" ? "PATCH" : "POST",
                body: JSON.stringify(body),
              },
            );
            await load();
            if (result.token || result.secret || result.clientSecret)
              setSecret(result);
            return result;
          }}
        />
      )}{" "}
      {secret && (
        <FormDialog
          title="Save your credential"
          fields={[]}
          submit="Done"
          onClose={() => setSecret(null)}
          onSave={async () => true}
        >
          <p className="muted">
            This credential is displayed once. Store it somewhere secure.
          </p>
          {secret.id && (
            <label className="feature-field">
              <span>ID</span>
              <input className="input" readOnly value={secret.id} />
            </label>
          )}
          <div className="feature-inline">
            <input
              className="input"
              aria-label="Credential"
              readOnly
              value={secret.token || secret.secret || secret.clientSecret}
            />
            <Action
              onClick={() =>
                navigator.clipboard.writeText(
                  secret.token || secret.secret || secret.clientSecret,
                )
              }
            >
              <Copy size={14} />
              Copy
            </Action>
          </div>
        </FormDialog>
      )}
      {deleting && (
        <Confirm
          title={`Revoke ${deleting.name || "webhook"}?`}
          description="Clients using this credential or endpoint will lose access immediately."
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(`${base}/${deleting.id}`, { method: "DELETE" });
            await load();
            return true;
          }}
        />
      )}
      {deliveries && (
        <FormDialog
          title="Webhook deliveries"
          fields={[]}
          submit="Done"
          onClose={() => setDeliveries(null)}
          onSave={async () => true}
        >
          {!deliveries.items.length && (
            <p className="muted">
              No deliveries yet. Matching workspace changes create signed
              deliveries.
            </p>
          )}
          {deliveries.items.map((d: any) => (
            <div className="feature-settings-row" key={d.id}>
              <div>
                <strong>{d.status}</strong>
                <p>
                  {date(d.createdAt || d.created_at)} · {d.attempts} attempts
                </p>
                {d.lastError || d.last_error ? (
                  <p className="feature-error">{d.lastError || d.last_error}</p>
                ) : null}
              </div>
              <span>{d.lastStatus || d.last_status || "—"}</span>
              <Action
                onClick={async () => {
                  try {
                    await api(`/api/v1/webhook-deliveries/${d.id}/retry`, {
                      method: "POST",
                    });
                    const r = await api(
                      `${base}/${deliveries.hook.id}/deliveries`,
                    );
                    setDeliveries({
                      ...deliveries,
                      items: r.nodes || r.items || r,
                    });
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                Retry
              </Action>
            </div>
          ))}
        </FormDialog>
      )}
    </>
  );
}

function WorkflowAutomationSettings({ teamId }: { teamId: string }) {
  const { data, update, act } = useActions();
  const team = data.teams.find((t) => t.id === teamId);
  if (!team) return null;
  const patch = (key: string, value: any) =>
    act(() => update("teams", team.id, { [key]: value }));
  return (
    <SettingSection title="Automations">
      {[
        [
          "autoCloseSubIssues",
          "Close sub-issues when the parent issue is completed",
        ],
        [
          "autoCloseParentIssues",
          "Close parent issues when all sub-issues are completed",
        ],
        ["autoAddStartedToCycle", "Add started issues to the current cycle"],
        [
          "autoAddCompletedToCycle",
          "Add completed issues to the current cycle",
        ],
      ].map(([key, label]) => (
        <SettingRow key={key} title={label}>
          <Toggle
            label={label}
            value={!!team[key]}
            onChange={(v) => patch(key, v)}
          />
        </SettingRow>
      ))}
      <SettingRow title="Automatically close inactive issues">
        <PreferenceSelect
          label="Close inactive issues"
          value={String(team.autoCloseDays || 0)}
          values={[
            { value: "0", label: "Never" },
            { value: "30", label: "After 30 days" },
            { value: "90", label: "After 90 days" },
            { value: "180", label: "After 180 days" },
          ]}
          onChange={(v) => patch("autoCloseDays", Number(v))}
        />
      </SettingRow>
      <SettingRow title="Automatically archive completed issues">
        <PreferenceSelect
          label="Archive completed issues"
          value={String(team.autoArchiveDays || 0)}
          values={[
            { value: "0", label: "Never" },
            { value: "30", label: "After 30 days" },
            { value: "90", label: "After 90 days" },
            { value: "180", label: "After 180 days" },
          ]}
          onChange={(v) => patch("autoArchiveDays", Number(v))}
        />
      </SettingRow>
    </SettingSection>
  );
}

function PendingInvitations() {
  const { toast } = useActions();
  const [invitations, setInvitations] = useState<any[]>([]),
    [error, setError] = useState("");
  const load = () =>
    api("/api/v1/invitations")
      .then((r) => {
        setInvitations(r.nodes || []);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <SettingSection title="Invitations">
      {error ? (
        <p className="feature-error">{error}</p>
      ) : invitations.length ? (
        invitations.map((i) => (
          <SettingRow
            title={i.email}
            description={`${i.role} · ${i.acceptedAt || i.accepted_at ? "Accepted" : `Expires ${date(i.expiresAt || i.expires_at)}`}`}
            key={i.id}
          >
            <Action
              onClick={async () => {
                try {
                  await api(`/api/v1/invitations/${i.id}`, {
                    method: "DELETE",
                  });
                  await load();
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              Revoke
            </Action>
          </SettingRow>
        ))
      ) : (
        <SettingRow title="No pending invitations">
          <Action onClick={load}>Refresh</Action>
        </SettingRow>
      )}
    </SettingSection>
  );
}

function DesktopConnection() {
  const [connection, setConnection] = useState<{
      serverUrl: string | null;
      activeUrl: string;
      mode: "embedded" | "remote";
    } | null>(null),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    window.desktop
      ?.getConnection()
      .then((value) => {
        setConnection(value);
        setUrl(value.serverUrl ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <SettingSection title="Desktop workspace">
      <SettingRow
        title="Workspace server"
        description={
          connection?.mode === "remote"
            ? `Connected to ${connection.activeUrl}`
            : "Use this Mac’s local workspace or connect to your shared workspace server."
        }
      >
        <span className="muted">
          {connection?.mode === "remote" ? "Shared server" : "Local workspace"}
        </span>
      </SettingRow>
      <form
        className="desktop-connection-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await window.desktop?.setConnection(url.trim() || null);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <label className="feature-field">
          <span>Server address</span>
          <input
            className="input"
            aria-label="Server address"
            type="url"
            placeholder="https://workspace.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <p className="muted">
          Leave blank to use the workspace stored on this Mac. Connecting
          restarts the app; your local workspace stays available.
        </p>
        {error && (
          <p className="feature-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary"
          type="submit"
          disabled={busy || !connection}
        >
          {busy ? "Connecting…" : "Restart and connect"}
        </button>
      </form>
    </SettingSection>
  );
}
