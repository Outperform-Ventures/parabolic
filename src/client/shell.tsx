import "./palette-visual.css";
import { PaletteKeycaps } from "./palette-keycaps";
import { contextualPaletteItems } from "./palette-contexts";
import { richTextToMarkdown } from "./markdown";
import { useSidebarDestinations } from "./sidebar-destinations";
import { SidebarNavigation, SidebarHelp } from "./sidebar-navigation";
import { SidebarTeamMenu } from "./sidebar-team-menu";
import { guestCapabilities } from "../shared/guest-capabilities";
import {
  creationAvailabilityForContext,
  contextualCreationAction,
  type DesktopCreationAvailability,
} from "../shared/desktop-creation";
import { workspaceWindowTitle } from "./window-title";
import { JoinAvailableWorkspaces } from "./features/approved-domains";
import { clearApplicationCache } from "./store";
import {
  desktopBadgeMode,
  type DesktopBadgeMode,
} from "../shared/desktop-badge";
import { CustomerRequestCommand } from "./features/customer-request-command";
import { subscriberValues } from "./subscriber-selection";
import { patchUserPreferences } from "./store";
import { orderSidebarTeams } from "./sidebar-teams";
import { joinedSidebarTeams } from "./sidebar-teams";
import { flushSync } from "react-dom";
import {
  availablePaletteCommands,
  retainedPaletteCommands,
} from "./palette-commands";
import { SelectedIssueRoute } from "./selected-issue-route";
import { pendingSaves } from "./pending-saves";
import { useLocalFontSize } from "./local-font-preference";
import { labelViewRoute } from "./label-view-route";
import { WorkspaceMenu } from "./workspace-menu";
import { IssueActionFilter } from "./issue-action-filter";
import {
  reserveHistoryTime,
  commitHistoryAction,
  redoIsCurrent,
} from "./history-clock";
import { InboxNavigationRead } from "./inbox-actions";
import {
  validTabRoute,
  anchorPinnedTabs,
  createWorkspaceTab,
  recordTabVisit,
  moveTabHistory,
  rememberClosedTabs,
  readClosedTabs,
  closedTabsKey,
  restoredTabsKey,
  restoreTabGroup,
  tabCloseControlVisible,
  tabUrl,
} from "./tab-model";
import { useNotificationClock } from "./use-notification-clock";
import { normalizeTabs, useTabCleanup, type WorkspaceTab } from "./tab-cleanup";
import { FavoritesSidebar } from "./favorites";
import {
  NativeSidebarIcon,
  NativeControlIcon,
  isNativeSidebarIconName,
} from "./components/sidebar-icons";
import {
  QuickResults,
  quickItem,
  quickNavigation,
  readRecentRoutes,
  recentRoutesKey,
  useQuickMatches,
} from "./quick-open";
import type { EntityKind } from "../shared/types";
import { displayNameFor } from "./display-name";
import {
  generateCustomTheme,
  themeInputFromPreferences,
  contrastRatio,
} from "./theme-colors";
import { fontSizePixels } from "./font-scale";
import { useDesktopLinkPreference } from "./desktop-links";
import { InboxPage } from "./inbox";
import { isInboxNotification, notificationBadgeCount } from "./inbox-data";
import { openReminder, pendingReminder, type ReminderKind } from "./reminders";
import { deliverDesktopNotification } from "./desktop-notifications";
import { EntityIcon } from "./features/entity-icon";
const TriagePage = React.lazy(() =>
  import("./triage").then((module) => ({ default: module.TriagePage })),
);
import { ShortcutReference } from "./shortcut-reference";
import { NewIssueLink } from "./new-issue-link";
import { OAuthConsentPage } from "./oauth";
import { SyncStatus } from "./sync-status";
import { TeamsPage } from "./teams";
import { Tooltips } from "./components/tooltips";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
  useParams,
} from "react-router-dom";
import {
  apiRequest,
  authenticate,
  dismissToast,
  initialize,
  useAppStore,
} from "./store";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  EmptyState,
  Icon,
  MenuItem,
  Modal,
  StatusIcon,
  TextInput,
} from "./components/ui";
import {
  active,
  IssueComposer,
  IssueList,
  IssuePage,
  issueName,
  openComposer,
} from "./issues";
import { relativeDate, textContent } from "./query";
import { ShortcutActions, dispatchWorkspaceCommand } from "./shortcut-actions";
import type { WorkspaceCommand } from "./keyboard";
import {
  ContactSupportDialog,
  FeedbackDialog,
  HelpDialog,
  PerformanceReportDialog,
  type HelpAction,
} from "./features/help";
import { HelpReferenceDialogs, openHelpReference } from "./help-references";
import "./features.css";
import { DraftsPage } from "./drafts";
const AsksPortal = React.lazy(() =>
  import("./features/asks-pages").then((m) => ({ default: m.AsksPortal })),
);
const PublicAskForm = React.lazy(() =>
  import("./features/asks").then((m) => ({ default: m.PublicAskForm })),
);
const ProjectsPage = React.lazy(() =>
  import("./features/projects").then((m) => ({ default: m.ProjectsPage })),
);
const ProjectPage = React.lazy(() =>
  import("./features/projects").then((m) => ({ default: m.ProjectPage })),
);
const InitiativesPage = React.lazy(() =>
  import("./features/projects").then((m) => ({ default: m.InitiativesPage })),
);
const InitiativePage = React.lazy(() =>
  import("./features/projects").then((m) => ({ default: m.InitiativePage })),
);
const CyclesPage = React.lazy(() =>
  import("./features/projects").then((m) => ({ default: m.CyclesPage })),
);
const DocumentsPage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.DocumentsPage })),
);
const DocumentPage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.DocumentPage })),
);
const CustomersPage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.CustomersPage })),
);
const CustomerRequestPage = React.lazy(() =>
  import("./features/customers").then((m) => ({
    default: m.CustomerRequestPage,
  })),
);
const CustomerPage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.CustomerPage })),
);
const AsksPage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.AsksPage })),
);
const InsightsPage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.InsightsPage })),
);
const DashboardsPage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.DashboardsPage })),
);
const ProjectViewPage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.ViewPage })),
);
const ViewsPage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.ViewsPage })),
);
const DuplicateIssueViewPage = React.lazy(() =>
  import("./duplicate-issue-view").then((m) => ({
    default: m.DuplicateIssueViewPage,
  })),
);
const ArchivePage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.ArchivePage })),
);
const TeamHomePage = React.lazy(() =>
  import("./features/content").then((m) => ({ default: m.TeamHomePage })),
);
const TeamDocumentsPage = React.lazy(() =>
  import("./features/team-documents").then((m) => ({
    default: m.TeamDocumentsPage,
  })),
);
const MembersPage = React.lazy(() =>
  import("./features/settings").then((m) => ({ default: m.Members })),
);
const SettingsPage = React.lazy(() =>
  import("./features/settings").then((m) => ({ default: m.SettingsPage })),
);
import type { Entity } from "../shared/types";
import {
  NativeTeamNavigationIcon,
  NativeSidebarDisclosure,
} from "./components/lower-sidebar-icons";
declare global {
  interface Window {
    desktop?: {
      isDesktop: boolean;
      setCreationAvailability?: (
        availability: DesktopCreationAvailability,
      ) => void;
      platform: string;
      getNavigationTabs?: () => Promise<boolean>;
      getDiagnostics?: () => Promise<Record<string, unknown>>;
      openDeveloperTools?: () => Promise<void>;
      getHardwareAcceleration?: () => Promise<{
        enabled: boolean;
        canDisable: boolean;
      }>;
      disableHardwareAcceleration?: () => Promise<{
        accepted: boolean;
        reason: "already-disabled" | "cancelled" | "relaunching";
      }>;
      onPrepareRestart?: (callback: () => Promise<void>) => () => void;
      onClearApplicationData?: (callback: () => Promise<void>) => () => void;
      getConnection: () => Promise<{
        serverUrl: string | null;
        activeUrl: string;
        mode: "embedded" | "remote";
      }>;
      setConnection: (serverUrl: string | null) => Promise<void>;
      onCommand: (
        cb: (event: { command: string; route?: string }) => void,
      ) => () => void;
      notify: (details: {
        title: string;
        body: string;
        route?: string;
        tag?: string;
      }) => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
      newWindow: (route?: string) => Promise<void>;
      newTab: (route?: string) => Promise<void>;
      setBadge: (count: number, mode?: DesktopBadgeMode) => Promise<void>;
      openNotificationSettings?: () => Promise<void>;
      setTheme: (theme: "system" | "dark" | "light") => Promise<void>;
      copyText: (text: string) => Promise<void>;
    };
  }
}

const navigation = [
  { label: "Inbox", path: "/inbox", icon: "Inbox" },
  { label: "My issues", path: "/my-issues", icon: "CheckCheck" },
  { label: "Initiatives", path: "/initiatives", icon: "Layers", section: true },
  { label: "Projects", path: "/projects", icon: "Box" },
  { label: "Teams", path: "/teams", icon: "Users" },
  { label: "Views", path: "/views", icon: "Layers" },
  { label: "Documents", path: "/documents", icon: "FileText" },
  { label: "Customers", path: "/customers", icon: "Building2" },
  { label: "Insights", path: "/insights", icon: "BarChart3" },
  { label: "Dashboards", path: "/dashboards", icon: "LayoutDashboard" },
  { label: "Asks", path: "/asks", icon: "MessageSquare" },
];
export function App() {
  const store = useAppStore(),
    route = useLocation();
  const publicForm = route.pathname.startsWith("/request/");
  const creationRole = store.data.memberships.find(
    (m) =>
      m.userId === store.user?.id &&
      m.workspaceId === store.data.workspaceId &&
      !m.teamId &&
      !m.deletedAt,
  )?.role;
  const creationGuest = guestCapabilities(store.data, store.user?.id);
  const creationWorkspace = store.data.workspaces.find(
    (item) => item.id === store.data.workspaceId,
  );
  useEffect(() => {
    window.desktop?.setCreationAvailability?.(
      creationAvailabilityForContext(
        store.ready && !store.initialSyncing && !!store.user && !publicForm,
        creationRole,
        {
          pathname: route.pathname,
          search: route.search,
          views: store.data.views,
          initiativesEnabled: creationWorkspace?.initiativesEnabled,
          customersEnabled: creationWorkspace?.customersEnabled,
          guestTeamIds: creationGuest.teamIds,
        },
      ),
    );
  }, [
    store.ready,
    store.initialSyncing,
    store.user?.id,
    store.data.workspaceId,
    creationRole,
    publicForm,
    route.pathname,
    route.search,
    store.data.views,
    creationWorkspace?.initiativesEnabled,
    creationWorkspace?.customersEnabled,
    store.data.teams,
    store.data.memberships,
  ]);
  useEffect(
    () => window.desktop?.onPrepareRestart?.(() => pendingSaves.flush()),
    [],
  );
  useEffect(
    () => window.desktop?.onClearApplicationData?.(clearApplicationCache),
    [],
  );
  useEffect(() => {
    void initialize();
  }, [publicForm]);
  const prefs =
    store.data.users.find((u) => u.id === store.user?.id)?.preferences ??
    store.user?.preferences ??
    {};
  const localFontSize = useLocalFontSize(
    prefs.fontSize,
    store.ready && !!store.user,
  );
  useDesktopLinkPreference(!!prefs.openDesktop, store.ready && !!store.user);
  useEffect(() => {
    document.body.spellcheck = prefs.spellcheck !== false;
  }, [prefs.spellcheck]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const root = document.documentElement;
      const mode = prefs.theme ?? "dark";
      const theme =
        mode === "system"
          ? media.matches
            ? ["light", "pure-light"].includes(prefs.themeSystemLight)
              ? prefs.themeSystemLight
              : "light"
            : ["dark", "magic-blue", "classic-dark"].includes(
                  prefs.themeSystemDark,
                )
              ? prefs.themeSystemDark
              : "dark"
          : mode;
      root.dataset.theme = theme;
      root.dataset.motion = prefs.reduceMotion ? "reduced" : "full";
      root.dataset.pointer =
        prefs.pointerCursor === true ? "pointer" : "default";
      root.dataset.underline = prefs.underlineLinks ? "always" : "hover";
      root.style.fontSize = `${fontSizePixels(localFontSize)}px`;
      for (const key of [
        "--bg",
        "--accent",
        "--sidebar",
        "--panel",
        "--hover",
        "--selected",
        "--text",
        "--muted",
        "--border",
        "--text-secondary",
        "--popover",
        "--popover-border",
        "--control-bg",
        "--nav-muted",
        "--subtle",
        "--window-tab-bg",
        "--sidebar-accent",
        "--sidebar-text",
        "--sidebar-hover",
        "--sidebar-selected",
        "--sidebar-border",
        "--semantic-blue",
        "--semantic-orange",
        "--semantic-orange-mid",
        "--semantic-purple",
        "--semantic-red",
        "--semantic-green",
        "--semantic-yellow",
      ])
        root.style.removeProperty(key);
      const custom = generateCustomTheme(themeInputFromPreferences(prefs));
      if (mode === "custom")
        for (const [key, value] of Object.entries(custom))
          root.style.setProperty(key, value);
      void window.desktop?.setTheme(
        mode === "system"
          ? "system"
          : theme === "light" || theme === "pure-light"
            ? "light"
            : mode === "custom" &&
                contrastRatio(custom["--bg"], "#000000") >
                  contrastRatio(custom["--bg"], "#ffffff")
              ? "light"
              : "dark",
      );
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [prefs, localFontSize]);
  if (publicForm && store.ready && store.user)
    return (
      <React.Suspense
        fallback={<div className="app-loading">Loading form…</div>}
      >
        <Routes>
          <Route
            path="/request/:formId"
            element={<PublicAskForm key={store.user.id + route.pathname} />}
          />
        </Routes>
      </React.Suspense>
    );
  if (!store.ready)
    return (
      <div className="app-loading">
        <span className="brand-mark" />
        <span>Loading workspace…</span>
      </div>
    );
  return (
    <>
      <Tooltips />
      <SyncStatus />
      {store.user ? (
        route.pathname === "/ask-site" ||
        route.pathname.startsWith("/ask-site/") ? (
          <React.Suspense
            fallback={<div className="app-loading">Loading Asks…</div>}
          >
            <AsksPortal />
          </React.Suspense>
        ) : route.pathname === "/oauth/authorize" ? (
          <OAuthConsentPage />
        ) : (
          <Workspace key={`${store.user.id}:${store.data.workspaceId}`} />
        )
      ) : (
        <AuthPage />
      )}
      <div className="toast-stack" aria-live="polite">
        {store.toasts.map((t) => (
          <div className="toast" key={t.id}>
            <Icon name="CheckCircle2" />
            <span>{t.message}</span>
            {t.action && (
              <Link
                to={t.action.route}
                onClick={(event) => {
                  event.preventDefault();
                  dispatchWorkspaceCommand({
                    command: "open-toast-link",
                    route: t.action!.route,
                  });
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </Link>
            )}
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(t.id)}
            >
              <Icon name="X" size={13} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function AuthPage() {
  const store = useAppStore(),
    navigate = useNavigate();
  const [fields, setFields] = useState({
      name: "",
      email: "",
      password: "",
      workspaceName: "Workspace",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const invite = new URLSearchParams(location.search).get("token");
  const inviteLink = new URLSearchParams(location.search).get("link");
  const join = location.pathname === "/join" && !!(invite || inviteLink);
  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="brand-mark large" />
        <h1>
          {join
            ? "Join your workspace"
            : store.setupRequired
              ? "Create your workspace"
              : "Log in to your workspace"}
        </h1>
        <p>
          {store.setupRequired
            ? "Your internal space for issues, projects and plans."
            : "Welcome back."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (join) {
                await apiRequest(
                  inviteLink ? "/auth/join-link" : "/auth/join",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      ...fields,
                      token: inviteLink || invite,
                    }),
                  },
                );
                await store.reload();
                navigate("/my-issues", { replace: true });
              } else
                await authenticate(
                  store.setupRequired ? "setup" : "login",
                  fields,
                );
            } catch (error) {
              setError(error instanceof Error ? error.message : String(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          {(store.setupRequired || join) && (
            <label>
              Full name
              <input
                autoFocus
                required
                autoComplete="name"
                value={fields.name}
                onChange={(e) => setFields({ ...fields, name: e.target.value })}
              />
            </label>
          )}
          {store.setupRequired && (
            <label>
              Workspace name
              <input
                required
                value={fields.workspaceName}
                onChange={(e) =>
                  setFields({ ...fields, workspaceName: e.target.value })
                }
              />
            </label>
          )}
          <label>
            Email
            <input
              autoFocus={!store.setupRequired}
              required
              type="email"
              autoComplete="username"
              value={fields.email}
              onChange={(e) => setFields({ ...fields, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              minLength={store.setupRequired || join ? 12 : 1}
              autoComplete={
                store.setupRequired ? "new-password" : "current-password"
              }
              placeholder={store.setupRequired ? "At least 12 characters" : ""}
              value={fields.password}
              onChange={(e) =>
                setFields({ ...fields, password: e.target.value })
              }
            />
          </label>
          {(error || store.error) && (
            <div className="error-text" role="alert">
              {error || store.error}
            </div>
          )}
          <button className="button primary" type="submit" disabled={busy}>
            {busy
              ? "Please wait…"
              : join
                ? "Join workspace"
                : store.setupRequired
                  ? "Create workspace"
                  : "Continue with email"}
            <Icon name="ArrowRight" size={15} />
          </button>
        </form>
      </div>
    </main>
  );
}

function Workspace() {
  const [alwaysShowTabs, setAlwaysShowTabs] = useState(true);
  useEffect(() => {
    void window.desktop?.getNavigationTabs?.().then(setAlwaysShowTabs);
  }, []);
  const store = useAppStore(),
    navigate = useNavigate(),
    location = useLocation();
  const [composer, setComposer] = useState<Record<string, any> | null>(null),
    [palette, setPalette] = useState(false),
    [shortcuts, setShortcuts] = useState(false),
    [help, setHelp] = useState(false),
    [helpAction, setHelpAction] = useState<HelpAction | null>(null),
    [hardwareAcceleration, setHardwareAcceleration] = useState<{
      enabled: boolean;
      canDisable: boolean;
    } | null>(null),
    [sidebar, setSidebar] = useState(true),
    [createWorkspace, setCreateWorkspace] = useState(false),
    [leaveTeam, setLeaveTeam] = useState<Entity | null>(null),
    [crossPageUndo, setCrossPageUndo] = useState<{
      at: number;
      issueId: string;
      identifier: string;
      route: string;
    } | null>(null),
    [tabContext, setTabContext] = useState<{
      id: string;
      x: number;
      y: number;
      nonce: number;
    } | null>(null);
  useEffect(() => {
    let active = true;
    void window.desktop?.getHardwareAcceleration?.().then((value) => {
      if (active) setHardwareAcceleration(value);
    });
    return () => {
      active = false;
    };
  }, []);
  const sidebarTeamOrder =
    store.data.users.find((u) => u.id === store.user?.id)?.preferences
      ?.sidebar?.[store.data.workspaceId]?.teamOrder || [];
  const visibleSidebarTeams = orderSidebarTeams(
    joinedSidebarTeams(
      store.data.teams,
      store.data.memberships,
      store.user?.id,
    ),
    sidebarTeamOrder,
  );
  const [teamDrop, setTeamDrop] = useState<string | null>(null),
    [teamDropAfter, setTeamDropAfter] = useState(false);
  const moveSidebarTeam = (from: string, to: string, after = false) => {
    if (
      from === to ||
      !visibleSidebarTeams.some((t) => t.id === from) ||
      !visibleSidebarTeams.some((t) => t.id === to)
    )
      return;
    const ids = visibleSidebarTeams
      .map((t) => t.id)
      .filter((id) => id !== from);
    ids.splice(ids.indexOf(to) + (after ? 1 : 0), 0, from);
    void patchUserPreferences(store.user!.id, {
      sidebar: { [store.data.workspaceId]: { teamOrder: ids } },
    }).catch((e) => store.toast(e.message));
  };
  const teamsSectionKey = `sidebar-teams-collapsed:${store.user?.id}:${store.data.workspaceId}`;
  const rememberedSidebar = useSidebarDestinations();
  const [teamsSectionByScope, setTeamsSectionByScope] = useState<
    Record<string, boolean>
  >({});
  const teamsCollapsed =
    teamsSectionByScope[teamsSectionKey] ??
    (() => {
      try {
        return localStorage.getItem(teamsSectionKey) === "true";
      } catch {
        return false;
      }
    })();
  const setTeamsCollapsed = (value: boolean) => {
    setTeamsSectionByScope((previous) => ({
      ...previous,
      [teamsSectionKey]: value,
    }));
    try {
      localStorage.setItem(teamsSectionKey, String(value));
    } catch {}
  };
  const collapsedTeamsKey = `collapsed-teams:${store.user?.id}:${store.data.workspaceId}`;
  const [collapsedByScope, setCollapsedByScope] = useState<
    Record<string, string[]>
  >({});
  const collapsedTeams =
    collapsedByScope[collapsedTeamsKey] ??
    (() => {
      try {
        const value = JSON.parse(
          localStorage.getItem(collapsedTeamsKey) ?? "null",
        );
        return Array.isArray(value)
          ? value.filter((id): id is string => typeof id === "string")
          : store.data.teams.map((team) => team.id);
      } catch {
        return store.data.teams.map((team) => team.id);
      }
    })();
  const setCollapsedTeams = (ids: string[]) => {
    setCollapsedByScope((previous) => ({
      ...previous,
      [collapsedTeamsKey]: ids,
    }));
    try {
      localStorage.setItem(collapsedTeamsKey, JSON.stringify(ids));
    } catch {
      /* Navigation remains usable when storage is unavailable. */
    }
  };
  const routeIcon = (route: string) => {
    const path = new URL(route, window.location.origin).pathname,
      parts = path.split("/");
    if (parts[1] === "profiles")
      return (
        <Avatar
          user={store.data.users.find((user) => user.id === parts[2])}
          size={14}
        />
      );
    const issue =
      parts[1] === "issues"
        ? store.data.issues.find(
            (row) => row.id === parts[2] || row.identifier === parts[2],
          )
        : undefined;
    if (issue)
      return (
        <StatusIcon
          status={store.data.statuses.find((row) => row.id === issue.statusId)}
          size={14}
        />
      );
    const entity =
      parts[1] === "view"
        ? store.data.views.find((row) => row.id === parts[2])
        : parts[1] === "project"
          ? store.data.projects.find((row) => row.id === parts[2])
          : parts[1] === "team"
            ? store.data.teams.find((row) => row.id === parts[2])
            : undefined;
    if (entity) return <EntityIcon entity={entity} size={14} />;
    const name = (
      {
        inbox: "Inbox",
        "my-issues": "My issues",
        projects: "Projects",
        teams: "Teams",
        views: "Views",
        initiatives: "Initiatives",
      } as const
    )[parts[1] as "inbox"];
    return name ? (
      <NativeSidebarIcon name={name} />
    ) : (
      <Icon
        name={
          parts[1] === "search"
            ? "Search"
            : parts[1] === "document"
              ? "FileText"
              : "Layers"
        }
        size={14}
      />
    );
  };
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => {
    try {
      return normalizeTabs(
        JSON.parse(
          localStorage.getItem(
            `workspace-tabs:${store.user?.id}:${store.data.workspaceId}`,
          ) ?? "null",
        ),
        location.pathname + location.search + location.hash,
      );
    } catch {
      return normalizeTabs(
        null,
        location.pathname + location.search + location.hash,
      );
    }
  });
  const activeTabKey = `workspace-active-tab:${store.user?.id}:${store.data.workspaceId}`;
  const [tabId, setTabId] = useState(
    () =>
      tabs.find(
        (tab) =>
          tab.route === location.pathname + location.search + location.hash,
      )?.id ??
      tabs.find((tab) => tab.id === sessionStorage.getItem(activeTabKey))?.id ??
      tabs.find((tab) => !tab.pinned)?.id ??
      tabs[0]?.id ??
      "initial",
  );
  useLayoutEffect(() => {
    sessionStorage.setItem(activeTabKey, tabId);
  }, [activeTabKey, tabId]);
  const pendingTabNavigation = useRef<{ id: string; route: string } | null>(
    null,
  );
  const activateTab = (tab: WorkspaceTab) => {
    pendingTabNavigation.current = { id: tab.id, route: tab.route };
    setTabId(tab.id);
    navigate(tab.route, { replace: true });
  };
  useTabCleanup({
    tabs,
    activeId: tabId,
    interval: store.user?.preferences?.desktopTabCleanupInterval,
    blocked:
      store.initialSyncing ||
      !store.online ||
      store.pending > 0 ||
      store.conflicts.length > 0 ||
      store.failures.length > 0,
    userId: store.user!.id,
    workspaceId: store.data.workspaceId,
    setTabs,
  });
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return readRecentRoutes(store.data.workspaceId, store.user!.id);
    } catch {
      return [];
    }
  });
  const sequence = useRef({ key: "", at: 0 });
  const hasDesktop = !!window.desktop;
  const guestAccess = guestCapabilities(store.data, store.user?.id);
  const defaultTeam = store.data.teams.find((team) =>
    guestAccess.canTeam(team.id),
  );
  const workspace =
    store.data.workspaces.find((w) => w.id === store.data.workspaceId) ??
    store.data.workspaces[0];
  const inboxNow = useNotificationClock(store.data.notifications);
  const notifications = store.data.notifications
    .filter((n) => isInboxNotification(n, store.user?.id))
    .filter(
      (n) =>
        (!n.userId || n.userId === store.user?.id) &&
        !n.readAt &&
        (!n.snoozedUntil || Date.parse(n.snoozedUntil) <= inboxNow),
    );
  const inboxPreferences =
    store.data.users.find((user) => user.id === store.user?.id)?.preferences
      ?.inbox ??
    store.user?.preferences?.inbox ??
    {};
  const inboxBadge = notificationBadgeCount(
    store.data.notifications,
    store.data.issues,
    store.user?.id,
    inboxPreferences,
    inboxNow,
    {
      comments: store.data.comments,
      updates: store.data.updates,
      requests: store.data.requests,
    },
  );
  const oldNotifications = useRef(
    new Set(
      store.data.notifications
        .filter((n) => isInboxNotification(n, store.user?.id))
        .map((n) => n.id),
    ),
  );
  const notificationScope = `${store.user?.id}:${store.data.workspaceId}`;
  const previousNotificationScope = useRef(notificationScope);
  const routeLabel = (savedRoute: string) => {
    const savedUrl = new URL(savedRoute, window.location.origin),
      route = savedUrl.pathname;
    if (route.startsWith("/settings"))
      return workspaceWindowTitle(savedRoute, store.data, "Settings");
    if (route.startsWith("/profiles/"))
      return workspaceWindowTitle(savedRoute, store.data, "Member unavailable");
    if (route === "/search")
      return savedUrl.searchParams.get("q")?.trim()
        ? `Search: ${savedUrl.searchParams.get("q")!.trim()}`
        : "Search";
    if (route === "/views") {
      const model = savedUrl.searchParams.get("type") || "issues";
      return model[0].toUpperCase() + model.slice(1);
    }
    if (route === "/initiatives")
      return savedUrl.searchParams.get("tab") || "All initiatives";
    const labelRoute = labelViewRoute(route, store.data);
    if (labelRoute) return labelRoute.entity?.name ?? "Label unavailable";
    if (route.startsWith("/issues/"))
      return (
        store.data.issues
          .filter((i) => i.id === route.split("/")[2])
          .map((i) => (i.identifier || "Issue") + " " + i.title)[0] ?? "Issue"
      );
    if (route.startsWith("/project/"))
      return (
        store.data.projects.find((i) => i.id === route.split("/")[2])?.name ??
        "Project"
      );
    if (route.startsWith("/document/"))
      return (
        store.data.documents.find((i) => i.id === route.split("/")[2])?.title ??
        "Document"
      );
    const entitySection = (
      {
        initiative: ["initiatives", "Initiative"],
        customer: ["customers", "Customer"],
        view: ["views", "View"],
        cycles: ["cycles", "Cycle"],
      } as const
    )[route.split("/")[1] as "initiative" | "customer" | "view" | "cycles"];
    if (entitySection && route.split("/")[2]) {
      const entity = store.data[entitySection[0]].find(
        (item) => item.id === route.split("/")[2],
      );
      return (
        entity?.name ||
        (entitySection[0] === "cycles" && entity?.number
          ? `Cycle ${entity.number}`
          : entitySection[1])
      );
    }
    if (route.startsWith("/team/")) {
      const team = store.data.teams.find((t) => t.id === route.split("/")[2]);
      const section = route.split("/")[3];
      return section === "all"
        ? "All issues"
        : section === "overview"
          ? (team?.name ?? "Team")
          : `${team?.name ?? ""} ${section ?? ""}`;
    }
    return (
      navigation.find((n) => n.path === route)?.label ??
      route
        .split("/")
        .filter(Boolean)
        .map((s) => s[0].toUpperCase() + s.slice(1))
        .join(" › ") ??
      "Workspace"
    );
  };
  const newTab = (route?: string) => {
    route ??= store.user?.preferences?.homeView ?? "/my-issues";
    if (!validTabRoute(route)) route = "/my-issues";
    const id = crypto.randomUUID();
    const tab = createWorkspaceTab(id, route);
    setTabs((t) => [...t, tab]);
    activateTab(tab);
  };
  const historyScope = `${store.user!.id}/${store.data.workspaceId}`;
  const rememberManualClose = (ids: Set<string>) => {
    if (!tabs.some((tab) => ids.has(tab.id))) return;
    const at = reserveHistoryTime(historyScope);
    rememberClosedTabs(
      localStorage,
      store.data.workspaceId,
      store.user!.id,
      tabs,
      ids,
      at,
    );
    localStorage.removeItem(
      restoredTabsKey(store.data.workspaceId, store.user!.id),
    );
    commitHistoryAction(historyScope, at);
  };
  const closeTab = (id: string) => {
    rememberManualClose(new Set([id]));
    const index = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    if (!next.length) {
      if (hasDesktop) {
        window.close();
        return;
      }
      const replacement = createWorkspaceTab(crypto.randomUUID(), "/my-issues");
      setTabs([replacement]);
      activateTab(replacement);
      return;
    }
    setTabs(next);
    if (id === tabId) {
      const target = next[Math.min(index, next.length - 1)];
      activateTab(target);
    }
  };
  const moveHistory = (delta: number) => {
    const active = tabs.find((tab) => tab.id === tabId);
    if (!active) return;
    const next = moveTabHistory(active, delta);
    if (next === active) return;
    if (active.pinned) {
      const opened = { ...next, id: crypto.randomUUID(), pinned: false };
      setTabs((current) => [...current, opened]);
      activateTab(opened);
    } else {
      setTabs((current) =>
        current.map((tab) => (tab.id === tabId ? next : tab)),
      );
      activateTab(next);
    }
  };
  const reopenTabs = (manualOnly = false) => {
    const groups = readClosedTabs(
        localStorage,
        store.data.workspaceId,
        store.user!.id,
      ),
      index = manualOnly
        ? groups.findLastIndex((group) => !group.automatic)
        : groups.length - 1,
      group = groups[index];
    if (group) {
      const result = restoreTabGroup(tabs, group, () => crypto.randomUUID());
      groups.splice(index, 1);
      localStorage.setItem(
        closedTabsKey(store.data.workspaceId, store.user!.id),
        JSON.stringify(groups),
      );
      localStorage.removeItem(
        `parabolic:closed-tab:${store.data.workspaceId}:${store.user?.id}`,
      );
      if (!group.automatic) {
        const future = readClosedTabs(
          localStorage,
          store.data.workspaceId,
          store.user!.id,
          true,
        ).filter((group) => redoIsCurrent(historyScope, group.undoneAt));
        future.push({
          ...group,
          undoneAt: reserveHistoryTime(historyScope),
          restoredIds: result.tabs
            .filter((tab) => !tabs.some((before) => before.id === tab.id))
            .map((tab) => tab.id),
        });
        localStorage.setItem(
          restoredTabsKey(store.data.workspaceId, store.user!.id),
          JSON.stringify(future.slice(-40)),
        );
      }
      setTabs(result.tabs);
      activateTab(result.tabs.find((tab) => tab.id === result.activeId)!);
    } else if (!manualOnly) {
      const route = localStorage.getItem(
        `parabolic:closed-tab:${store.data.workspaceId}:${store.user?.id}`,
      );
      if (route) {
        localStorage.removeItem(
          `parabolic:closed-tab:${store.data.workspaceId}:${store.user?.id}`,
        );
        newTab(route);
      }
    }
  };
  const replayTabClose = () => {
    const future = readClosedTabs(
        localStorage,
        store.data.workspaceId,
        store.user!.id,
        true,
      ).filter((group) => redoIsCurrent(historyScope, group.undoneAt)),
      group = future.pop();
    if (!group) return;
    const ids = new Set(group.restoredIds ?? []),
      closed = tabs.filter((tab) => ids.has(tab.id));
    if (!closed.length) return;
    rememberClosedTabs(
      localStorage,
      store.data.workspaceId,
      store.user!.id,
      tabs,
      ids,
      reserveHistoryTime(historyScope),
    );
    localStorage.setItem(
      restoredTabsKey(store.data.workspaceId, store.user!.id),
      JSON.stringify(future),
    );
    const remaining = tabs.filter((tab) => !ids.has(tab.id)),
      next = remaining.length
        ? remaining
        : [createWorkspaceTab(crypto.randomUUID(), "/my-issues")];
    setTabs(next);
    if (ids.has(tabId))
      activateTab(
        next[
          Math.min(
            tabs.findIndex((tab) => tab.id === tabId),
            next.length - 1,
          )
        ],
      );
  };
  const historyCommandBusy = useRef(false);
  const undoOrRedo = async (direction: "undo" | "redo") => {
    if (historyCommandBusy.current) return;
    historyCommandBusy.current = true;
    try {
      if (direction === "undo") {
        const group = readClosedTabs(
          localStorage,
          store.data.workspaceId,
          store.user!.id,
        )
          .filter((group) => !group.automatic)
          .at(-1);
        if (group && group.at >= store.undoAt) reopenTabs(true);
        else if (store.canUndo) {
          const frame = store.undoFrame,
            change = frame?.changes.length === 1 ? frame.changes[0] : undefined,
            currentRoute = location.pathname + location.search + location.hash;
          if (
            change?.kind === "issues" &&
            change.action === "delete" &&
            frame?.route?.startsWith(`/issues/${change.entityId}`) &&
            frame.route !== currentRoute
          ) {
            const issue = store.data.issues.find(
              (item) => item.id === change.entityId,
            );
            setCrossPageUndo({
              at: store.undoAt,
              issueId: change.entityId,
              identifier: issue ? issueName(issue) : "issue",
              route: frame.route,
            });
          } else await store.undo();
        }
      } else {
        const group = readClosedTabs(
          localStorage,
          store.data.workspaceId,
          store.user!.id,
          true,
        )
          .filter((group) => redoIsCurrent(historyScope, group.undoneAt))
          .at(-1);
        if (group && (group.undoneAt ?? 0) >= store.redoAt) replayTabClose();
        else if (store.canRedo) await store.redo();
      }
    } finally {
      historyCommandBusy.current = false;
    }
  };
  const recentParts = location.pathname.split("/"),
    recentKind = (
      {
        issues: "issues",
        project: "projects",
        document: "documents",
        initiative: "initiatives",
        customer: "customers",
        team: "teams",
        cycles: "cycles",
        view: "views",
      } as Record<string, EntityKind>
    )[recentParts[1]];
  const recentRoutePresent =
    !recentKind ||
    !recentParts[2] ||
    store.data[recentKind].some(
      (entity) => entity.id === recentParts[2] && !entity.deletedAt,
    );
  useLayoutEffect(() => {
    const route = location.pathname + location.search + location.hash,
      active = tabs.find((tab) => tab.id === tabId);
    if (pendingTabNavigation.current) {
      if (
        pendingTabNavigation.current.id !== tabId ||
        pendingTabNavigation.current.route !== route
      )
        return;
      pendingTabNavigation.current = null;
    }
    if (route !== "/" && active?.pinned && active.route !== route) {
      const next = createWorkspaceTab(crypto.randomUUID(), route);
      setTabs((current) => [...current, next]);
      setTabId(next.id);
    } else if (route !== "/")
      setTabs((current) =>
        current.map((tab) =>
          tab.id === tabId ? recordTabVisit(tab, route) : tab,
        ),
      );
    const old = readRecentRoutes(store.data.workspaceId, store.user!.id),
      next = recentRoutePresent
        ? [
            location.pathname,
            ...old.filter((route) => route !== location.pathname),
          ].slice(0, 30)
        : old;
    localStorage.setItem(
      recentRoutesKey(store.data.workspaceId, store.user!.id),
      JSON.stringify(next),
    );
    setRecent(next);
  }, [
    location.pathname,
    location.search,
    location.hash,
    tabId,
    recentRoutePresent,
  ]);
  const currentWindowTitle = workspaceWindowTitle(
    location.pathname + location.search,
    store.data,
    routeLabel(location.pathname + location.search),
  );
  useEffect(() => {
    document.title = currentWindowTitle;
  }, [currentWindowTitle]);
  useEffect(
    () =>
      localStorage.setItem(
        `workspace-tabs:${store.user?.id}:${store.data.workspaceId}`,
        JSON.stringify(tabs),
      ),
    [tabs],
  );
  useEffect(() => {
    const preferences =
      store.data.users.find((user) => user.id === store.user?.id)
        ?.preferences ||
      store.user?.preferences ||
      {};
    void window.desktop?.setBadge(inboxBadge, desktopBadgeMode(preferences));
    if (previousNotificationScope.current === notificationScope)
      for (const n of notifications) {
        if (!oldNotifications.current.has(n.id))
          void deliverDesktopNotification(
            n,
            preferences.notifications || {},
            store.data,
          ).catch(() => {});
      }
    previousNotificationScope.current = notificationScope;
    oldNotifications.current = new Set(
      store.data.notifications
        .filter((n) => isInboxNotification(n, store.user?.id))
        .map((n) => n.id),
    );
  }, [
    store.data.notifications,
    store.data.users,
    store.user?.preferences?.notificationBadge,
    inboxBadge,
  ]);
  const creationLabelRoute = labelViewRoute(location.pathname, store.data);
  const creationLabel = creationLabelRoute?.entity;
  const labelCreationDefaults = creationLabel
    ? {
        teamId: creationLabel.teamId ?? defaultTeam?.id,
        ...(creationLabelRoute.kind === "labels" && !creationLabel.archivedAt
          ? { labelIds: [creationLabel.id] }
          : {}),
      }
    : {};
  const assignedCreationDefaults =
    location.pathname.startsWith("/my-issues") &&
    [null, "assigned"].includes(
      new URLSearchParams(location.search).get("tab")?.toLocaleLowerCase() ?? null,
    )
      ? { assigneeId: store.user?.id }
      : {};
  const command = (event: WorkspaceCommand) => {
    switch (event.command) {
      case "undo":
      case "redo":
        void undoOrRedo(event.command);
        break;
      case "new-issue-expanded":
        openComposer({
          expanded: true,
          teamId: defaultTeam?.id,
          ...labelCreationDefaults,
          ...assignedCreationDefaults,
        });
        break;
      case "open-drafts":
        navigate("/drafts");
        break;
      case "back":
        moveHistory(-1);
        break;
      case "forward":
        moveHistory(1);
        break;
      case "close-other-tabs":
        rememberManualClose(
          new Set(
            tabs
              .filter((tab) => tab.id !== tabId && !tab.pinned)
              .map((tab) => tab.id),
          ),
        );
        setTabs((current) =>
          current.filter((tab) => tab.id === tabId || tab.pinned),
        );
        break;
      case "close-tabs-right": {
        const index = tabs.findIndex((tab) => tab.id === tabId);
        if (index < 0) break;
        const ids = new Set(
          tabs
            .slice(index + 1)
            .filter((tab) => !tab.pinned)
            .map((tab) => tab.id),
        );
        rememberManualClose(ids);
        setTabs((current) => current.filter((tab) => !ids.has(tab.id)));
        break;
      }
      case "pin-tab":
        setTabs((current) =>
          anchorPinnedTabs(
            current.map((tab) =>
              tab.id === tabId ? { ...tab, pinned: !tab.pinned } : tab,
            ),
          ),
        );
        break;
      case "select-tab": {
        const tab =
          event.value === "last" ? tabs.at(-1) : tabs[Number(event.value)];
        if (tab) {
          activateTab(tab);
        }
        break;
      }
      case "new-issue":
        openComposer({
          teamId: location.pathname.startsWith("/team/")
            ? location.pathname.split("/")[2]
            : defaultTeam?.id,
          ...labelCreationDefaults,
          ...assignedCreationDefaults,
        });
        break;
      case "new-contextual": {
        const path = location.pathname,
          context = {
            pathname: path,
            search: location.search,
            views: store.data.views,
            initiativesEnabled: workspace?.initiativesEnabled,
            customersEnabled: workspace?.customersEnabled,
            guestTeamIds: guestAccess.teamIds,
          },
          action = contextualCreationAction(context),
          params = new URLSearchParams(location.search);
        const role = store.data.memberships.find(
          (item) =>
            item.userId === store.user?.id &&
            item.workspaceId === store.data.workspaceId &&
            !item.teamId &&
            !item.deletedAt,
        )?.role;
        if (
          creationAvailabilityForContext(true, role, context).contextual !==
          "enabled"
        )
          break;
        if (action === "view") {
          params.set("new", "1");
          navigate({ pathname: path, search: params.toString() });
        } else if (action === "initiative") {
          const destination = /^\/team\/[^/]+\/initiatives$/.test(path)
            ? path
            : "/initiatives";
          if (path === destination) {
            params.set("new", "1");
            navigate({ pathname: destination, search: params.toString() });
          } else navigate(destination + "?new=1");
        } else if (action === "project") {
          const team = /^\/team\/([^/]+)\/projects$/.exec(path),
            initiative = /^\/initiative\/([^/]+)/.exec(path);
          navigate(
            (team ? path : "/projects") +
              "?new=1" +
              (initiative
                ? "&initiativeId=" + encodeURIComponent(initiative[1])
                : ""),
          );
        } else {
          const project = /^\/project\/([^/]+)/.exec(path),
            team = /^\/team\/([^/]+)/.exec(path),
            projectRecord = store.data.projects.find(
              (item) => item.id === project?.[1],
            ),
            projectTeam = [
              projectRecord?.teamId,
              ...(projectRecord?.teamIds ?? []),
            ].find((id) => id && guestAccess.canTeam(id));
          openComposer({
            teamId: team?.[1] || projectTeam || defaultTeam?.id,
            ...(project ? { projectId: project[1] } : {}),
            ...labelCreationDefaults,
            ...assignedCreationDefaults,
          });
        }
        break;
      }
      case "new-initiative": {
        const role = store.data.memberships.find(
          (item) =>
            item.userId === store.user?.id &&
            item.workspaceId === store.data.workspaceId &&
            !item.teamId &&
            !item.deletedAt,
        )?.role;
        if (
          creationAvailabilityForContext(true, role, {
            pathname: location.pathname,
            search: location.search,
            views: store.data.views,
            initiativesEnabled: workspace?.initiativesEnabled,
          }).initiative === "enabled"
        )
          navigate("/initiatives?new=1");
        break;
      }
      case "navigation-tabs":
        setAlwaysShowTabs(event.value !== false);
        break;
      case "new-tab":
        newTab(event.route);
        break;
      case "new-project":
        if (guestAccess.canCreate)
          navigate(
            guestAccess.guest
              ? "/team/" + defaultTeam?.id + "/projects?new=1"
              : "/projects?new=1",
          );
        break;
      case "new-document":
        if (guestAccess.canCreate)
          navigate(
            guestAccess.guest
              ? "/documents?new=1&parentKind=teams&parentId=" + defaultTeam?.id
              : "/documents?new=1",
          );
        break;
      case "command-menu":
        setPalette(true);
        break;
      case "search":
        navigate("/search");
        break;
      case "settings":
        navigate("/settings");
        break;
      case "open-recently-viewed":
        document
          .querySelector<HTMLButtonElement>(
            '[aria-label="Open recently viewed dialog"]',
          )
          ?.click();
        break;
      case "create-workspace":
        setCreateWorkspace(true);
        break;
      case "leave-team": {
        const team = store.data.teams.find((item) => item.id === event.value);
        if (team) setLeaveTeam(team);
        break;
      }
      case "navigate":
        navigate(event.route ?? "/my-issues");
        break;
      case "open-toast-link":
        setComposer(null);
        navigate(event.route ?? "/my-issues");
        break;
      case "toggle-sidebar":
        setSidebar((s) => !s);
        break;
      case "keyboard-shortcuts":
        setShortcuts(true);
        break;
      case "help":
        setHelp(true);
        break;
      case "contact-support":
        setHelpAction("support");
        break;
      case "send-feedback":
        setHelpAction("feedback");
        break;
      case "report-performance-problem":
        setHelpAction("performance");
        break;
      case "open-parabolic-documentation":
        openHelpReference("documentation");
        break;
      case "open-api-documentation":
        openHelpReference("api-documentation");
        break;
      case "open-parabolic-status":
        openHelpReference("status");
        break;
      case "disable-hardware-acceleration":
        void window.desktop?.disableHardwareAcceleration?.().then((result) => {
          if (result.reason === "already-disabled")
            setHardwareAcceleration({ enabled: false, canDisable: false });
        });
        break;
      case "close-tab":
        closeTab(tabId);
        break;
      case "next-tab": {
        const tab =
          tabs[(tabs.findIndex((t) => t.id === tabId) + 1) % tabs.length];
        if (tab) {
          activateTab(tab);
        }
        break;
      }
      case "previous-tab": {
        const tab =
          tabs[
            (tabs.findIndex((t) => t.id === tabId) + tabs.length - 1) %
              tabs.length
          ];
        if (tab) {
          activateTab(tab);
        }
        break;
      }
      case "reopen-tab": {
        reopenTabs();
        break;
      }
    }
  };
  useEffect(() => {
    const create = (event: Event) => {
      const defaults = (event as CustomEvent).detail ?? {};
      if (
        !guestAccess.canCreate ||
        !guestAccess.canTeam(defaults.teamId || defaultTeam?.id)
      ) {
        store.toast("Issue creation requires explicit team membership");
        return;
      }
      setComposer({ ...defaults, teamId: defaults.teamId || defaultTeam?.id });
    };
    window.addEventListener("create-issue", create);
    return () => {
      window.removeEventListener("create-issue", create);
    };
  }, [tabs, tabId, store.data.teams, store.data.memberships, store.user?.id]);
  const isSettings = location.pathname.startsWith("/settings");
  return (
    <div
      className={`workspace-shell ${hasDesktop ? "desktop" : "web"} ${!sidebar ? "sidebar-collapsed" : ""} ${isSettings ? "settings-shell" : ""}`}
    >
      <InboxNavigationRead />
      <div
        className={`tab-strip ${!hasDesktop && tabs.length === 1 ? "single-web-tab" : ""} ${hasDesktop && !alwaysShowTabs && tabs.length === 1 ? "single-navigation-title" : ""}`}
      >
        <div className="traffic-light-space" />
        <button
          className="icon-button"
          aria-label="Toggle sidebar"
          onClick={() => setSidebar(!sidebar)}
        >
          <NativeControlIcon name="Collapse navigation sidebar" />
        </button>
        <Dropdown
          trigger={
            <button
              className="icon-button"
              aria-label="Open recently viewed dialog"
            >
              <NativeControlIcon name="Open recently viewed dialog" />
            </button>
          }
          menuClassName="recently-viewed-menu"
        >
          <div className="menu-label">Recently viewed</div>
          {recent.map((route) => {
            const label = routeLabel(route),
              kind = (
                {
                  view: "View",
                  team: "Team",
                  project: "Project",
                  document: "Document",
                  initiative: "Initiative",
                  customer: "Customer",
                  cycles: "Cycle",
                } as Record<string, string>
              )[new URL(route, window.location.origin).pathname.split("/")[1]];
            return (
              <Link
                key={route}
                className="menu-item"
                role="menuitem"
                to={route}
                aria-label={kind ? `${kind} ${label}` : label}
              >
                {kind && <span className="recent-route-kind">{kind}</span>}
                <span>{label}</span>
              </Link>
            );
          })}
        </Dropdown>
        <button
          className="icon-button"
          aria-label="Back"
          onClick={() => moveHistory(-1)}
        >
          <NativeControlIcon name="Go back" />
        </button>
        <button
          className="icon-button"
          aria-label="Forward"
          onClick={() => moveHistory(1)}
        >
          <NativeControlIcon name="Go forward" />
        </button>
        <div className="tabs">
          {tabs.map((tab) => (
            <div
              className={`app-tab ${tab.id === tabId ? "active" : ""} ${tab.pinned ? "pinned" : ""}`}
              data-tab-id={tab.id}
              key={tab.id}
              tabIndex={0}
              onClick={() => {
                activateTab(tab);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activateTab(tab);
                }
              }}
              onContextMenu={(event) => {
                if (!hasDesktop) return;
                event.preventDefault();
                activateTab(tab);
                setTabContext({
                  id: tab.id,
                  x: event.clientX,
                  y: event.clientY,
                  nonce: Date.now(),
                });
                window.setTimeout(() =>
                  document
                    .querySelector<HTMLInputElement>(
                      '[aria-label="Filter tab actions"]',
                    )
                    ?.focus(),
                  0,
                );
              }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/tab-id", tab.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/tab-id");
                const moving = tabs.find((t) => t.id === id);
                if (moving) {
                  const others = tabs.filter((t) => t.id !== id);
                  others.splice(
                    others.findIndex((t) => t.id === tab.id),
                    0,
                    moving,
                  );
                  setTabs(anchorPinnedTabs(others));
                }
              }}
            >
              {routeIcon(tab.route)}
              <span>{routeLabel(tab.route)}</span>
              {tab.pinned && <Icon name="Pin" size={11} />}
              {tab.id === tabId && (
                <button
                  className="icon-button"
                  aria-label="Copy tab URL"
                  onClick={(e) => {
                    e.stopPropagation();
                    const operation = window.desktop?.copyText
                      ? window.desktop.copyText(
                          tabUrl(tab.route, window.location.origin),
                        )
                      : navigator.clipboard.writeText(
                          tabUrl(tab.route, window.location.origin),
                        );
                    void operation
                      .then(() => store.toast("Copied to clipboard"))
                      .catch((error) =>
                        store.toast(
                          error instanceof Error
                            ? error.message
                            : "Could not copy tab URL",
                        ),
                      );
                  }}
                >
                  <Icon name="Link" size={11} />
                </button>
              )}
              {tabCloseControlVisible(tabs.length, hasDesktop) &&
                !tab.pinned && (
                  <button
                    className="icon-button"
                    aria-label="Close tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    <Icon name="X" size={11} />
                  </button>
                )}
            </div>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="New tab"
          onClick={() => newTab()}
        >
          <NativeControlIcon name="Open new tab" />
        </button>
        {tabContext && (() => {
          const tab = tabs.find((candidate) => candidate.id === tabContext.id);
          if (!tab) return null;
          const copyUrl = () => {
            const url = tabUrl(tab.route, window.location.origin);
            const operation = window.desktop?.copyText
              ? window.desktop.copyText(url)
              : navigator.clipboard.writeText(url);
            void operation
              .then(() => store.toast("Copied to clipboard"))
              .catch((error) =>
                store.toast(error instanceof Error ? error.message : "Could not copy tab URL"),
              );
          };
          return (
            <Dropdown
              key={tabContext.nonce}
              position={{ x: tabContext.x, y: tabContext.y }}
              onOpenChange={(open) => {
                if (!open) {
                  const id = tabContext.id;
                  setTabContext(null);
                  requestAnimationFrame(() =>
                    document
                      .querySelector<HTMLElement>(
                        `[data-tab-id="${CSS.escape(id)}"]`,
                      )
                      ?.focus(),
                  );
                }
              }}
              trigger={<span />}
            >
              <IssueActionFilter searchLabel="Filter tab actions">
                <span className="native-visually-hidden" role="status">
                  Showing all items
                </span>
                <MenuItem
                  icon="Pin"
                  shortcut="⌃ ⇧ P"
                  onClick={() =>
                    setTabs((current) =>
                      anchorPinnedTabs(
                        current.map((candidate) =>
                          candidate.id === tab.id
                            ? { ...candidate, pinned: !candidate.pinned }
                            : candidate,
                        ),
                      ),
                    )
                  }
                >
                  {tab.pinned ? "Unpin tab" : "Pin tab"}
                </MenuItem>
                <MenuItem icon="Plus" shortcut="⌘ T" onClick={() => newTab()}>
                  New tab
                </MenuItem>
                <MenuItem icon="Copy" onClick={() => newTab(tab.route)}>
                  Duplicate tab
                </MenuItem>
                <MenuItem icon="Link" shortcut="⌘ ⇧ C" onClick={copyUrl}>
                  Copy URL
                </MenuItem>
                <div className="menu-separator" />
                <MenuItem icon="X" shortcut="⌘ W" onClick={() => closeTab(tab.id)}>
                  Close tab
                </MenuItem>
                <MenuItem
                  icon="X"
                  shortcut="⌘ ⌥ W"
                  onClick={() => {
                    const ids = new Set(
                      tabs
                        .filter((candidate) => candidate.id !== tab.id && !candidate.pinned)
                        .map((candidate) => candidate.id),
                    );
                    rememberManualClose(ids);
                    setTabs((current) =>
                      current.filter((candidate) => candidate.id === tab.id || candidate.pinned),
                    );
                  }}
                >
                  Close other tabs
                </MenuItem>
                {tabs.some(
                  (candidate, index) =>
                    index > tabs.indexOf(tab) && !candidate.pinned,
                ) && (
                  <MenuItem
                    icon="X"
                    onClick={() => {
                      const tabIndex = tabs.indexOf(tab);
                      const ids = new Set(
                        tabs
                          .slice(tabIndex + 1)
                          .filter((candidate) => !candidate.pinned)
                          .map((candidate) => candidate.id),
                      );
                      rememberManualClose(ids);
                      setTabs((current) =>
                        current.filter((candidate) => !ids.has(candidate.id)),
                      );
                    }}
                  >
                    Close tabs to the right
                  </MenuItem>
                )}
                <MenuItem
                  icon="ExternalLink"
                  onClick={() => {
                    if (!window.desktop) return;
                    void window.desktop
                      .newWindow(tab.route)
                      .then(() => closeTab(tab.id))
                      .catch((error) =>
                        store.toast(error instanceof Error ? error.message : "Could not move tab"),
                      );
                  }}
                >
                  Move to new window
                </MenuItem>
              </IssueActionFilter>
            </Dropdown>
          );
        })()}
      </div>
      <div className="shell-main">
        {sidebar && !isSettings && (
          <aside className="sidebar">
            <div className="workspace-switcher">
              <WorkspaceMenu
                name={workspace?.name ?? "Workspace"}
                workspaceId={store.data.workspaceId}
                workspaces={store.data.workspaces}
                canManageMembers={["owner", "admin"].includes(
                  store.data.memberships.find(
                    (m) =>
                      !m.deletedAt && !m.teamId && m.userId === store.user?.id,
                  )?.role || "",
                )}
                onSettings={() => navigate("/settings")}
                onMembers={() => navigate("/settings/members")}
                onSwitch={async (workspaceId) => {
                  await apiRequest("/auth/workspace", {
                    method: "POST",
                    body: JSON.stringify({ workspaceId }),
                  });
                  await store.reload();
                  navigate("/my-issues");
                }}
                onCreate={() => setCreateWorkspace(true)}
                onLogout={store.logout}
                onError={(message) => store.toast(message)}
              />
              <span className="spacer" />
              <button
                className="icon-button"
                aria-label="Search workspace"
                onClick={() => navigate("/search")}
              >
                <NativeControlIcon name="Search workspace" />
              </button>
              <button
                className="new-issue-button icon-button"
                aria-label="Create new issue"
                disabled={!guestAccess.canCreate}
                onClick={() =>
                  openComposer({
                    teamId: defaultTeam?.id,
                    ...labelCreationDefaults,
                    ...assignedCreationDefaults,
                  })
                }
              >
                <NativeControlIcon name="Create new issue" />
              </button>
            </div>
            <div className="sidebar-scroll">
              <SidebarNavigation
                inboxBadge={inboxBadge}
                canRoute={guestAccess.canRoute}
                guest={guestAccess.guest}
                workspace={workspace}
                onOpenTab={newTab}
              />
              <FavoritesSidebar onOpenTab={newTab} />
              <div className="sidebar-section-title sidebar-teams-heading">
                <button
                  aria-expanded={!teamsCollapsed}
                  onClick={() => setTeamsCollapsed(!teamsCollapsed)}
                >
                  Your teams
                  <NativeSidebarDisclosure expanded={!teamsCollapsed} />
                </button>
                <span className="spacer" />
                <button
                  className="icon-button"
                  hidden={guestAccess.guest}
                  aria-label="Join a team"
                  onClick={() => {
                    const joined = joinedSidebarTeams(
                      store.data.teams,
                      store.data.memberships,
                      store.user?.id,
                    );
                    navigate(
                      store.data.teams.some(
                        (t) =>
                          !t.deletedAt &&
                          !t.archivedAt &&
                          !t.retiredAt &&
                          !joined.some((j) => j.id === t.id),
                      )
                        ? "/teams"
                        : "/settings/teams?new=1",
                    );
                  }}
                >
                  <Icon name="Plus" size={12} />
                </button>
              </div>
              {!teamsCollapsed &&
                visibleSidebarTeams.map((team) => (
                  <div
                    className="sidebar-team"
                    key={team.id}
                    draggable
                    data-team-id={team.id}
                    data-drag-over={teamDrop === team.id}
                    data-drag-after={teamDropAfter}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/sidebar-team", team.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setTeamDrop(null)}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes("text/sidebar-team")) {
                        e.preventDefault();
                        setTeamDrop(team.id);
                        const bounds = e.currentTarget.getBoundingClientRect();
                        setTeamDropAfter(
                          e.clientY > bounds.top + bounds.height / 2,
                        );
                        const scroll =
                          e.currentTarget.closest(".sidebar-scroll");
                        if (scroll) {
                          const r = scroll.getBoundingClientRect();
                          if (e.clientY < r.top + 40) scroll.scrollTop -= 18;
                          if (e.clientY > r.bottom - 40) scroll.scrollTop += 18;
                        }
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node))
                        setTeamDrop(null);
                    }}
                    onDrop={(e) => {
                      const from = e.dataTransfer.getData("text/sidebar-team");
                      if (from) {
                        e.preventDefault();
                        const r = e.currentTarget.getBoundingClientRect();
                        moveSidebarTeam(
                          from,
                          team.id,
                          e.clientY > r.top + r.height / 2,
                        );
                        setTeamDrop(null);
                      }
                    }}
                  >
                    <div className="team-heading">
                      <button
                        aria-expanded={!collapsedTeams.includes(team.id)}
                        onClick={() =>
                          setCollapsedTeams(
                            collapsedTeams.includes(team.id)
                              ? collapsedTeams.filter((id) => id !== team.id)
                              : [...collapsedTeams, team.id],
                          )
                        }
                        aria-label={team.name}
                        title="Drag to reorder teams. Option + Up/Down moves this team."
                        onKeyDown={(e) => {
                          if (
                            e.altKey &&
                            ["ArrowUp", "ArrowDown"].includes(e.key)
                          ) {
                            e.preventDefault();
                            const i = visibleSidebarTeams.findIndex(
                                (t) => t.id === team.id,
                              ),
                              target =
                                visibleSidebarTeams[
                                  i + (e.key === "ArrowUp" ? -1 : 1)
                                ];
                            if (target)
                              moveSidebarTeam(
                                team.id,
                                target.id,
                                e.key === "ArrowDown",
                              );
                          }
                        }}
                      >
                        <EntityIcon entity={team} fallback="Layers" size={14} />
                        <strong
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {team.name}
                        </strong>
                        <NativeSidebarDisclosure
                          expanded={!collapsedTeams.includes(team.id)}
                          team
                        />
                      </button>
                      <SidebarTeamMenu team={team} guest={guestAccess.guest} />
                    </div>
                    {!collapsedTeams.includes(team.id) && (
                      <div className="team-links">
                        {[
                          ["Home", "overview", "Home"],
                          ...(team.triageEnabled
                            ? [["Triage", "triage", "Inbox"]]
                            : []),
                          ["Issues", "all", "Circle"],
                          ["Projects", "projects", "Box"],
                          ...(team.cycleEnabled || team.cyclesEnabled
                            ? [["Cycles", "cycles", "Repeat"]]
                            : []),
                          ["Views", "views", "Layers"],
                        ].map(([label, section, icon]) => (
                          <NavLink
                            key={section}
                            to={rememberedSidebar.destination(
                              `/team/${team.id}/${section}`,
                            )}
                            className={({ isActive }) =>
                              `sidebar-link ${rememberedSidebar.active(`/team/${team.id}/${section}`) ? "active" : ""}`
                            }
                          >
                            {label === "Home" || label === "Issues" ? (
                              <NativeTeamNavigationIcon name={label} />
                            ) : isNativeSidebarIconName(label) ? (
                              <NativeSidebarIcon name={label} />
                            ) : (
                              <Icon name={icon} size={14} />
                            )}
                            <span>{label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            <div className="sidebar-footer">
              <SidebarHelp
                onHelp={() => setHelpAction("support")}
                onShortcuts={() => setShortcuts(true)}
              />
              {store.hydrating && (
                <span className="sync-indicator" role="status">
                  <Icon name="RefreshCw" size={13} />
                  Loading workspace…
                </span>
              )}
              {!store.online && (
                <span className="sync-indicator">
                  <Icon name="WifiOff" size={13} />
                  Offline
                </span>
              )}
              {store.pending > 0 && (
                <span className="sync-indicator">
                  <Icon name="RefreshCw" size={13} />
                  {store.pending} syncing
                </span>
              )}
            </div>
          </aside>
        )}
        <section className="main-panel">
          {!sidebar && (
            <button
              className="restore-sidebar icon-button"
              aria-label="Show sidebar"
              onClick={() => setSidebar(true)}
            >
              <Icon name="PanelLeft" />
            </button>
          )}
          <React.Suspense
            fallback={<div className="app-loading">Loading…</div>}
          >
            {!guestAccess.canRoute(location.pathname) ? (
              <EmptyState
                title="Page unavailable"
                description="Guests can access work in teams they have joined."
                action={
                  <Button onClick={() => navigate("/my-issues")}>
                    My issues
                  </Button>
                }
              />
            ) : (
              <Routes>
                <Route
                  path="/"
                  element={
                    <Navigate
                      to={store.user?.preferences?.homeView ?? "/my-issues"}
                      replace
                    />
                  }
                />
                <Route path="/new" element={<NewIssueLink />} />
                <Route path="/team/:teamKey/new" element={<NewIssueLink />} />
                <Route
                  path="/members"
                  element={
                    <div className="feature-page">
                      <MembersPage directory />
                    </div>
                  }
                />
                <Route path="/drafts" element={<DraftsPage />} />
                <Route path="/my-issues" element={<IssueList />} />
                <Route
                  path="/profiles/:profileId/:profileTab?"
                  element={<IssueList filterButtonLabel="Add filter" />}
                />
                <Route path="/all" element={<IssueList section="all" />} />
                <Route
                  path="/issues/all"
                  element={<IssueList section="all" />}
                />
                <Route
                  path="/issues/active"
                  element={<IssueList section="active" />}
                />
                <Route
                  path="/issues/backlog"
                  element={<IssueList section="backlog" />}
                />
                <Route path="/label/:labelId" element={<IssueList />} />
                <Route
                  path="/label-group/:labelGroupId"
                  element={<IssueList />}
                />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route
                  path="/team/:teamId/overview"
                  element={<TeamHomePage />}
                />
                <Route
                  path="/team/:teamId/documents"
                  element={<TeamDocumentsPage />}
                />
                <Route
                  path="/team/:teamId/members"
                  element={<TeamHomePage />}
                />
                <Route
                  path="/team/:teamId/archive/:archiveTab?"
                  element={<ArchivePage />}
                />
                <Route
                  path="/team/:teamId/projects"
                  element={<ProjectsPage />}
                />
                <Route
                  path="/team/:teamId/initiatives"
                  element={<InitiativesPage />}
                />
                <Route path="/team/:teamId/cycles" element={<CyclesPage />} />
                <Route
                  path="/team/:teamId/cycle/:cycleId"
                  element={<CyclesPage />}
                />
                <Route path="/team/:teamId/views" element={<ViewsPage />} />
                <Route path="/team/:teamId/triage" element={<TriagePage />} />
                <Route path="/team/:teamId/:section" element={<IssueList />} />
                <Route
                  path="/issues/:issueId"
                  element={<SelectedIssueRoute />}
                />
                <Route path="/teams" element={<TeamsPage />} />
                <Route path="/projects/all" element={<ProjectsPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route
                  path="/project/:projectId/:tab?"
                  element={<ProjectPage />}
                />
                <Route
                  path="/initiatives/:initiativeTab?"
                  element={<InitiativesPage />}
                />
                <Route
                  path="/initiative/:initiativeId/:tab?"
                  element={<InitiativePage />}
                />
                <Route path="/cycles/:cycleId?" element={<CyclesPage />} />
                <Route path="/views" element={<ViewsPage />} />
                <Route
                  path="/views/issues/new"
                  element={<DuplicateIssueViewPage />}
                />
                <Route path="/view/:viewId" element={<SavedViewRoute />} />
                <Route path="/view/:viewId/edit" element={<SavedViewRoute />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route
                  path="/document/:documentId"
                  element={<DocumentPage />}
                />
                <Route path="/customers" element={<CustomersPage />} />
                <Route
                  path="/customer/:customerId"
                  element={<CustomerPage />}
                />
                <Route
                  path="/customer-request/:requestId"
                  element={<CustomerRequestPage />}
                />
                <Route path="/asks" element={<AsksPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route
                  path="/dashboards/:dashboardId?"
                  element={<DashboardsPage />}
                />
                <Route
                  path="/settings/:section?/:subsection?"
                  element={<SettingsPage />}
                />
                <Route path="/archive" element={<ArchivePage />} />
                <Route
                  path="*"
                  element={
                    <EmptyState
                      title="Page not found"
                      description="This page may have moved."
                      action={
                        <Button onClick={() => navigate("/my-issues")}>
                          My issues
                        </Button>
                      }
                    />
                  }
                />
              </Routes>
            )}
          </React.Suspense>
        </section>
      </div>
      <>
        {createWorkspace && (
          <CreateWorkspaceDialog onClose={() => setCreateWorkspace(false)} />
        )}
        {leaveTeam && (
          <Modal
            title={`Leave ${leaveTeam.name}?`}
            onClose={() => setLeaveTeam(null)}
          >
            <div className="modal-body">
              <p>
                You will leave this team. Access to private team issues may be
                removed.
              </p>
            </div>
            <div className="modal-footer">
              <Button onClick={() => setLeaveTeam(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() =>
                  void apiRequest(`/api/v1/teams/${leaveTeam.id}/leave`, {
                    method: "POST",
                  })
                    .then(async () => {
                      await store.reload();
                      setLeaveTeam(null);
                      navigate("/teams");
                    })
                    .catch((error) => store.toast(error.message))
                }
              >
                Leave team
              </Button>
            </div>
          </Modal>
        )}
        {crossPageUndo && (
          <Modal
            title={`Undo delete ${crossPageUndo.identifier}?`}
            onClose={() => setCrossPageUndo(null)}
          >
            <div className="modal-body">
              <p>
                This operation was performed on a different page than you are
                currently on. Open that page and undo the operation?
              </p>
            </div>
            <div className="modal-footer">
              <Button onClick={() => setCrossPageUndo(null)}>Cancel</Button>
              <Button
                autoFocus
                variant="primary"
                onClick={() => {
                  const pending = crossPageUndo;
                  setCrossPageUndo(null);
                  if (!store.canUndo || store.undoAt !== pending.at) {
                    store.toast("A newer action replaced this undo history.");
                    return;
                  }
                  void store.undo().then((undone) => {
                    if (undone) navigate(pending.route);
                  });
                }}
              >
                Undo
              </Button>
            </div>
          </Modal>
        )}
      </>
      <ShortcutActions onCommand={command} tabs={tabs} />
      <CustomerRequestCommand />
      {composer && (
        <IssueComposer defaults={composer} onClose={() => setComposer(null)} />
      )}{" "}
      {palette && (
        <CommandPalette
          onClose={() => setPalette(false)}
          onShortcuts={() => setShortcuts(true)}
          recent={recent}
          routeLabel={routeLabel}
          hardwareAccelerationEnabled={
            hardwareAcceleration?.canDisable === true
          }
        />
      )}{" "}
      {shortcuts && <ShortcutReference onClose={() => setShortcuts(false)} />}
      {help && (
        <HelpDialog
          onClose={() => setHelp(false)}
          onShortcuts={() => setShortcuts(true)}
        />
      )}
      {helpAction === "support" && (
        <ContactSupportDialog onClose={() => setHelpAction(null)} />
      )}
      {helpAction === "feedback" && (
        <FeedbackDialog onClose={() => setHelpAction(null)} />
      )}
      {helpAction === "performance" && (
        <PerformanceReportDialog onClose={() => setHelpAction(null)} />
      )}
      <HelpReferenceDialogs />
    </div>
  );
}

function CommandPalette({
  onClose,
  onShortcuts,
  recent,
  routeLabel,
  hardwareAccelerationEnabled,
}: {
  onClose: () => void;
  onShortcuts: () => void;
  recent: string[];
  routeLabel: (route: string) => string;
  hardwareAccelerationEnabled: boolean;
}) {
  const store = useAppStore(),
    navigate = useNavigate(),
    location = useLocation();
  const [query, setQuery] = useState(""),
    [index, setIndex] = useState(0);
  const issueId = [
    ...document.querySelectorAll<HTMLElement>(
      ".issue-detail-view[data-issue-id]",
    ),
  ].at(-1)?.dataset.issueId;
  const issueListContext = document.querySelector<HTMLElement>(
    ".issue-view[data-selected-ids]",
  );
  const pickedIssueIds =
    issueListContext?.dataset.selectedIds?.split(",").filter(Boolean) ?? [];
  const singleListId =
    pickedIssueIds.length === 1
      ? pickedIssueIds[0]
      : !pickedIssueIds.length
        ? issueListContext?.dataset.focusedId
        : undefined;
  const currentIssue = store.data.issues.find(
    (issue) => issue.id === (issueId ?? singleListId),
  );
  const routeEntity = /^\/(project|document|initiative)\/([^/]+)/.exec(
    location.pathname,
  );
  const reminderKind: ReminderKind | undefined = currentIssue
    ? "issues"
    : routeEntity
      ? (
          {
            project: "projects",
            document: "documents",
            initiative: "initiatives",
          } as const
        )[routeEntity[1] as "project" | "document" | "initiative"]
      : undefined;
  const reminderId = currentIssue?.id ?? routeEntity?.[2];
  const reminder =
    reminderKind && reminderId
      ? pendingReminder(
          store.data.notifications,
          reminderKind,
          reminderId,
          store.user?.id,
        )
      : null;
  const documentContainer = currentIssue
    ? { kind: "issues", id: currentIssue.id }
    : routeEntity && ["project", "initiative"].includes(routeEntity[1])
      ? {
          kind: routeEntity[1] === "project" ? "projects" : "initiatives",
          id: routeEntity[2],
        }
      : (() => {
          const match = /^\/(team|cycles)\/([^/]+)/.exec(location.pathname);
          return match
            ? { kind: match[1] === "team" ? "teams" : "cycles", id: match[2] }
            : null;
        })();
  const issueList = document.querySelector<HTMLElement>(
    ".issue-view[data-selected-ids]",
  );
  const selectedIssueIds =
    issueList?.dataset.selectedIds?.split(",").filter(Boolean) ?? [];
  const targetedIssues = currentIssue
    ? [currentIssue]
    : store.data.issues.filter((issue) =>
        (selectedIssueIds.length
          ? selectedIssueIds
          : [issueList?.dataset.focusedId]
        ).includes(issue.id),
      );
  const projectCollection = document.querySelector<HTMLElement>(
    ".project-collection[data-selected-project-ids]",
  );
  const projectSelection =
    projectCollection?.dataset.selectedProjectIds?.split(",").filter(Boolean) ??
    [];
  const projectCount =
    projectSelection.length ||
    (projectCollection?.dataset.focusedProjectId
      ? 1
      : routeEntity?.[1] === "project"
        ? 1
        : 0);
  const targetedProjects = store.data.projects.filter((project) =>
    (projectSelection.length
      ? projectSelection
      : projectCollection?.dataset.focusedProjectId
        ? [projectCollection.dataset.focusedProjectId]
        : routeEntity?.[1] === "project"
          ? [routeEntity[2]]
          : []
    ).includes(project.id),
  );
  const currentProject =
    targetedProjects.length === 1 ? targetedProjects[0] : undefined;
  const commandTeamId = location.pathname.startsWith("/team/")
    ? location.pathname.split("/")[2]
    : (currentIssue?.teamId ??
      store.data.teams.find((team) => team.memberIds?.includes(store.user?.id))
        ?.id ??
      store.data.teams[0]?.id);
  const commandPageTeam = location.pathname.startsWith("/team/")
    ? store.data.teams.find((team) => team.id === commandTeamId)
    : undefined;
  const contextTeam =
    commandPageTeam ??
    (currentIssue
      ? store.data.teams.find((team) => team.id === currentIssue.teamId)
      : undefined);
  const overviewTeam = /^\/team\/[^/]+\/(overview|documents|members)$/.test(
    location.pathname,
  )
    ? commandPageTeam
    : undefined;
  const teamFavorite = contextTeam
    ? store.data.favorites.find(
        (item) =>
          !item.deletedAt &&
          item.userId === store.user?.id &&
          item.entityId === contextTeam.id,
      )
    : undefined;
  const copyTeamText = (text: string) =>
    void (
      window.desktop
        ? window.desktop.copyText(text)
        : navigator.clipboard.writeText(text)
    )
      .then(() => store.toast("Copied to clipboard"))
      .catch((error) => store.toast(error.message));
  const guestCommands = guestCapabilities(store.data, store.user?.id);
  const workspace = store.data.workspaces.find(
    (item) => item.id === store.data.workspaceId,
  );
  const workspaceRole = store.data.memberships.find(
    (item) =>
      item.userId === store.user?.id &&
      item.workspaceId === store.data.workspaceId &&
      !item.teamId &&
      !item.deletedAt,
  )?.role;
  const canManageWorkspace = ["owner", "admin"].includes(workspaceRole || "");
  const explicitOwners = (team: Entity) =>
    new Set([
      ...(team.ownerIds ??
        (team.ownerId || team.creatorId
          ? [team.ownerId || team.creatorId]
          : [])),
      ...store.data.memberships
        .filter(
          (item) =>
            item.teamId === team.id && item.role === "owner" && !item.deletedAt,
        )
        .map((item) => item.userId),
    ]);
  const ownsTeam = (team: Entity | undefined) => {
    if (!team) return false;
    if (canManageWorkspace) return true;
    const seen = new Set<string>();
    for (
      let current = team;
      current && !seen.has(current.id);
      current = store.data.teams.find((item) => item.id === current.parentId)!
    ) {
      seen.add(current.id);
      if (explicitOwners(current).has(store.user!.id)) return true;
    }
    return false;
  };
  const issueCommandTeam =
    targetedIssues.length === 1
      ? store.data.teams.find((team) => team.id === targetedIssues[0].teamId)
      : undefined;
  const canManageIssueTemplate =
    !!issueCommandTeam &&
    (issueCommandTeam.templateManagement !== "owners" ||
      ownsTeam(issueCommandTeam));
  const descendants = (teamId: string) => {
    const ids = new Set<string>(),
      queue = [teamId];
    while (queue.length) {
      const parent = queue.shift()!;
      for (const child of store.data.teams.filter(
        (item) => item.parentId === parent && !item.deletedAt,
      )) {
        if (!ids.has(child.id)) {
          ids.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return ids;
  };
  const canLeaveContextTeam =
    !!contextTeam &&
    (contextTeam.memberIds?.includes(store.user!.id) ||
      store.data.memberships.some(
        (item) =>
          item.userId === store.user?.id &&
          item.teamId === contextTeam.id &&
          !item.deletedAt,
      )) &&
    !explicitOwners(contextTeam).has(store.user!.id) &&
    ![...descendants(contextTeam.id)].some(
      (id) =>
        store.data.memberships.some(
          (item) =>
            item.userId === store.user?.id &&
            item.teamId === id &&
            !item.deletedAt,
        ) ||
        store.data.teams
          .find((item) => item.id === id)
          ?.memberIds?.includes(store.user!.id),
    );
  const canInvite =
    canManageWorkspace ||
    (workspaceRole === "member" && workspace?.allowMemberInvites === true);
  const canCreateTeam =
    !guestCommands.guest &&
    (workspace?.teamCreationPolicy !== "admins" || canManageWorkspace);
  const commands = [
    {
      label: "Open user…",
      icon: "User",
      shortcut: "O U",
      action: () =>
        dispatchWorkspaceCommand({ command: "open-picker", value: "user" }),
    },
    ...(overviewTeam
      ? [
          {
            label: "Add section…",
            icon: "Plus",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({ command: "team-add-section" }),
          },
          {
            label: "Add document to team overview…",
            icon: "FileText",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({ command: "team-add-resource" }),
          },
        ]
      : []),
    ...(contextTeam
      ? [
          {
            label: teamFavorite ? "Unfavorite team" : "Favorite team",
            icon: "Star",
            shortcut: "",
            action: () =>
              void (
                teamFavorite
                  ? store.remove("favorites", teamFavorite.id)
                  : store.create("favorites", {
                      type: "team",
                      entityId: contextTeam.id,
                      userId: store.user?.id,
                      label: contextTeam.name,
                      route: "/team/" + contextTeam.id + "/overview",
                    })
              ).catch((error) => store.toast(error.message)),
          },
        ]
      : []),
    ...(projectCollection
      ? [
          {
            label: "Add filter",
            icon: "Filter",
            shortcut: "",
            action: () =>
              projectCollection
                .querySelector<HTMLButtonElement>(
                  '[aria-label="Filter projects"]',
                )
                ?.click(),
          },
          {
            label: "Display options",
            icon: "SlidersHorizontal",
            shortcut: "",
            action: () =>
              projectCollection
                .querySelector<HTMLButtonElement>(
                  '[aria-label="Project display options"]',
                )
                ?.click(),
          },
        ]
      : []),
    ...(contextTeam
      ? [
          {
            label: "Copy team title",
            icon: "Copy",
            shortcut: "⌘ ⇧ '",
            action: () => copyTeamText(contextTeam.name),
          },
          {
            label: "Copy title as link",
            icon: "Link",
            shortcut: "⌘ C",
            action: () =>
              copyTeamText(
                "[" +
                  String(contextTeam.name)
                    .replaceAll("[", "\\[")
                    .replaceAll("]", "\\]") +
                  "](" +
                  new URL(
                    "/team/" + contextTeam.id + "/overview",
                    window.location.origin,
                  ).href +
                  ")",
              ),
          },
        ]
      : []),
    {
      label: "Create issue in fullscreen",
      icon: "Maximize",
      shortcut: "V",
      action: () => dispatchWorkspaceCommand({ command: "new-issue-expanded" }),
    },
    {
      label: "Create new label",
      icon: "Tag",
      shortcut: "",
      action: () => navigate("/settings/labels?new=1"),
    },
    ...["Issues", "Projects", "Initiatives", "Documents"].map((type) => ({
      label: "Go to recently deleted " + type.toLowerCase(),
      icon: "Trash2",
      shortcut: "",
      action: () => navigate("/archive?deleted=1&type=" + type),
    })),
    {
      label: "Add customer request",
      icon: "MessageSquare",
      shortcut: "⌃ R",
      action: () =>
        dispatchWorkspaceCommand({ command: "new-customer-request" }),
    },
    {
      label: "Create view",
      icon: "Layers",
      shortcut: "",
      action: () =>
        navigate(
          guestCommands.guest
            ? "/team/" + guestCommands.teamIds[0] + "/views?new=1"
            : "/views?new=1",
        ),
    },
    {
      label: "Create new initiative",
      icon: "Layers",
      shortcut: "N I",
      action: () => navigate("/initiatives?new=1"),
    },
    ...["issue", "document", "project"].map((type) => ({
      label: "Create new " + type + " template",
      icon: "FileText",
      shortcut: "",
      action: () =>
        navigate(
          (type === "project"
            ? "/settings/project-templates"
            : "/settings/templates") +
            "?new=" +
            type,
        ),
    })),
    {
      label: "Create new folder",
      icon: "FolderPlus",
      shortcut: "",
      action: () => window.dispatchEvent(new Event("create-favorite-folder")),
    },
    ...(recent.some((route) => /^\/issues\/[^/]+$/.test(route))
      ? [
          {
            label: "Open last viewed issue",
            icon: "History",
            shortcut: "",
            action: () =>
              navigate(
                recent.find((route) => /^\/issues\/[^/]+$/.test(route))!,
              ),
          },
        ]
      : []),
    {
      label: "Open in new window",
      icon: "ExternalLink",
      shortcut: "⌃ ,",
      action: () =>
        window.desktop
          ? window.desktop.newWindow(location.pathname + location.search)
          : window.open(
              location.pathname + location.search,
              "_blank",
              "noopener",
            ),
    },
    ...(commandTeamId
      ? [
          {
            label: "Open team archive",
            icon: "Archive",
            shortcut: "G X",
            action: () => navigate("/archive?team=" + commandTeamId),
          },
          ...["active", "backlog", "all"].map((section) => ({
            label:
              "Go to " +
              (section === "all"
                ? "all issues"
                : section === "active"
                  ? "active issues"
                  : "backlog"),
            icon: "Circle",
            shortcut: "",
            action: () => navigate("/team/" + commandTeamId + "/" + section),
          })),
        ]
      : []),
    ...retainedPaletteCommands({
      issue: targetedIssues.length > 0,
      shared: targetedIssues.some((issue) => issue.sharedAccess),
      list: !!issueList,
      count: targetedIssues.length || projectCount,
      subscribed:
        targetedIssues.length > 0 &&
        targetedIssues.every((issue) =>
          subscriberValues(issue).includes(store.user!.id),
        ),
      canManageTemplate: canManageIssueTemplate,
      project: !issueList && projectCount > 0,
      projectSubscribed:
        targetedProjects.length > 0 &&
        targetedProjects.every((project) =>
          (project.subscriberIds ?? []).includes(store.user!.id),
        ),
      initiative: !issueList && routeEntity?.[1] === "initiative",
      triageId:
        currentIssue &&
        store.data.statuses.find(
          (status) => status.id === currentIssue.statusId,
        )?.type === "triage"
          ? currentIssue.id
          : undefined,
      desktop: !!window.desktop,
      hardwareAccelerationEnabled,
    }).map((item) => ({
      ...item,
      action: () => dispatchWorkspaceCommand(item.command),
    })),
    {
      label: "Open label",
      icon: "Tag",
      shortcut: "O L",
      action: () =>
        dispatchWorkspaceCommand({ command: "open-picker", value: "label" }),
    },
    ...(routeEntity?.[1] === "document"
      ? [
          {
            label: "Move document",
            icon: "ArrowRight",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({ command: "move-document" }),
          },
        ]
      : []),
    ...(routeEntity?.[1] === "document"
      ? [
          {
            label: document.querySelector('[data-show-authors="true"]')
              ? "Hide author names"
              : "Show author names",
            icon: "Users",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({
                command: document.querySelector('[data-show-authors="true"]')
                  ? "hide-author-names"
                  : "show-author-names",
              }),
          },
          {
            label: "Copy document URL",
            icon: "Link",
            shortcut: "⌘ ⇧ ,",
            action: () =>
              dispatchWorkspaceCommand({ command: "copy-entity-url" }),
          },
          {
            label: "Copy document title",
            icon: "Copy",
            shortcut: "⌘ ⇧ '",
            action: () =>
              dispatchWorkspaceCommand({ command: "copy-entity-title" }),
          },
          {
            label: "Copy document as Markdown",
            icon: "Copy",
            shortcut: "⌘ ⌥ C",
            action: () =>
              dispatchWorkspaceCommand({ command: "copy-document-markdown" }),
          },
        ]
      : []),
    ...(reminderKind && reminderId
      ? [
          {
            label: reminder
              ? "Reschedule reminder"
              : `Remind me about this ${reminderKind.slice(0, -1)}`,
            icon: "Clock",
            shortcut: "H",
            action: () => openReminder(reminderKind, reminderId),
          },
          ...(reminder
            ? [
                {
                  label: "Cancel reminder",
                  icon: "Clock",
                  shortcut: "",
                  action: () =>
                    void store
                      .remove("notifications", reminder.id)
                      .then(() => store.toast("Reminder canceled")),
                },
              ]
            : []),
        ]
      : []),
    ...(currentIssue &&
    (currentIssue.canManageSharing || currentIssue.sharedAccess)
      ? [
          {
            label: "Share issue",
            icon: "Users",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({
                command: "share-issue",
                value: currentIssue.id,
              }),
          },
        ]
      : []),
    ...(targetedIssues.length
      ? [
          {
            label: "Assign to me",
            icon: "User",
            shortcut: "I",
            action: () =>
              void Promise.all(
                targetedIssues.map((issue) =>
                  store.update("issues", issue.id, {
                    assigneeId: targetedIssues.every(
                      (item) => item.assigneeId === store.user?.id,
                    )
                      ? null
                      : store.user?.id,
                  }),
                ),
              ).catch((error) => store.toast(error.message)),
          },
          {
            label: "Copy issue title as link",
            icon: "Link",
            shortcut: "⌘ C",
            action: () =>
              dispatchWorkspaceCommand({ command: "copy-issue-title-link" }),
          },
          {
            label: "Copy issue description",
            icon: "Copy",
            shortcut: "",
            action: () =>
              copyTeamText(
                targetedIssues
                  .map((issue) => richTextToMarkdown(issue.description ?? ""))
                  .join("\n\n"),
              ),
          },
          {
            label: "Favorite issue",
            icon: "Star",
            shortcut: "⌥ F",
            action: () =>
              dispatchWorkspaceCommand({ command: "toggle-favorite" }),
          },
          ...(!targetedIssues.some((issue) => issue.sharedAccess)
            ? [
                {
                  label: "Remove all subscribers",
                  icon: "Users",
                  shortcut: "",
                  action: () =>
                    void Promise.all(
                      targetedIssues.map((issue) =>
                        store.update("issues", issue.id, {
                          replaceSubscribers: true,
                          subscribers: [],
                        }),
                      ),
                    ).catch((error) => store.toast(error.message)),
                },
              ]
            : []),
          ...(targetedIssues.length === 1
            ? [
                {
                  label: "Rename issue",
                  icon: "Pencil",
                  shortcut: "⇧ R",
                  action: () =>
                    dispatchWorkspaceCommand({ command: "rename-issue" }),
                },
                {
                  label: "Add link to issue",
                  icon: "Link",
                  shortcut: "⌃ L",
                  action: () =>
                    dispatchWorkspaceCommand({ command: "link-url" }),
                },
                {
                  label: "Create document for issue",
                  icon: "FileText",
                  shortcut: "",
                  action: () =>
                    navigate(
                      "/documents?new=1&parentKind=issues&parentId=" +
                        targetedIssues[0].id,
                    ),
                },
              ]
            : []),
        ]
      : []),
    ...(currentIssue && !currentIssue.sharedAccess
      ? [
          {
            label: "Create sub-issue",
            icon: "GitBranch",
            shortcut: "⌘ ⇧ O",
            action: () =>
              openComposer({
                teamId: currentIssue.teamId,
                parentId: currentIssue.id,
              }),
          },
          {
            label: "Create multiple issues",
            icon: "List",
            shortcut: "",
            action: () =>
              openComposer({
                teamId: currentIssue.teamId,
                parentId: currentIssue.id,
                __multiple: true,
              }),
          },
          {
            label: "Create new sub-issue from template",
            icon: "FileText",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({
                command: "new-sub-issue-template",
                value: currentIssue.id,
              }),
          },
          ...(currentIssue.parentId
            ? [
                {
                  label: "Remove parent",
                  icon: "GitBranch",
                  shortcut: "",
                  action: () =>
                    void store.update("issues", currentIssue.id, {
                      parentId: null,
                    }),
                },
              ]
            : []),
          {
            label: "Duplicate issue",
            icon: "Copy",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({
                command: "duplicate-issue",
                value: currentIssue.id,
              }),
          },
          {
            label: currentIssue.recurrence
              ? "Edit recurrence"
              : "Convert into recurring issue",
            icon: "Repeat",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({
                command: "convert-issue-to-recurring",
                value: currentIssue.id,
              }),
          },
          {
            label: "Convert issue to project",
            icon: "Box",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({
                command: "convert-issue-to-project",
                value: currentIssue.id,
              }),
          },
        ]
      : []),
    ...(canManageWorkspace
      ? [
          {
            label: "Open suspended user…",
            icon: "User",
            shortcut: "",
            action: () => navigate("/settings/members?status=Suspended"),
          },
        ]
      : []),
    ...(canInvite
      ? [
          {
            label: "Invite to Parabolic…",
            icon: "UserPlus",
            shortcut: "",
            action: () => navigate("/settings/members?invite=1"),
          },
        ]
      : []),
    ...(canCreateTeam
      ? [
          {
            label: "Create a team…",
            icon: "Users",
            shortcut: "",
            action: () => navigate("/settings/teams?new=1"),
          },
        ]
      : []),
    {
      label: "Change interface theme…",
      icon: "Palette",
      shortcut: "",
      action: () => navigate("/settings/preferences?focus=theme"),
    },
    {
      label: "Change default view…",
      icon: "Home",
      shortcut: "",
      action: () => navigate("/settings/preferences?focus=default-view"),
    },
    ...(canLeaveContextTeam
      ? [
          {
            label: "Leave team…",
            icon: "LogOut",
            shortcut: "",
            action: () =>
              dispatchWorkspaceCommand({
                command: "leave-team",
                value: contextTeam!.id,
              }),
          },
        ]
      : []),
    {
      label: "Create new issue",
      icon: "Plus",
      shortcut: "C",
      action: () => dispatchWorkspaceCommand({ command: "new-issue" }),
    },
    ...(!currentIssue
      ? [
          {
            label: "Create multiple issues",
            icon: "List",
            shortcut: "",
            action: () => openComposer({ __multiple: true }),
          },
        ]
      : []),
    {
      label: "Create new project",
      icon: "Box",
      shortcut: "N P",
      action: () => dispatchWorkspaceCommand({ command: "new-project" }),
    },
    {
      label: "Create new document",
      icon: "FileText",
      shortcut: "",
      action: () =>
        navigate(
          "/documents?new=1" +
            (documentContainer
              ? "&" +
                new URLSearchParams({
                  parentKind: documentContainer.kind,
                  parentId: documentContainer.id,
                })
              : guestCommands.guest
                ? "&parentKind=teams&parentId=" + guestCommands.teamIds[0]
                : ""),
        ),
    },
    {
      label: "Create new customer",
      icon: "Building2",
      shortcut: "",
      action: () => navigate("/customers?new=1"),
    },
    ...navigation
      .filter((n) => guestCommands.canRoute(n.path))
      .map((n) => ({
        label: `Go to ${n.label.toLowerCase()}`,
        icon: n.icon,
        shortcut: "",
        action: () => navigate(n.path),
      })),
    {
      label: "Open settings",
      icon: "Settings",
      shortcut: "G S",
      action: () => navigate("/settings"),
    },
    {
      label: "Keyboard shortcuts",
      icon: "Command",
      shortcut: "⌘ /",
      action: onShortcuts,
    },
  ];
  const availableCommands = availablePaletteCommands(commands, guestCommands);
  const prefix = /^([iputlfd])\s(.*)$/is.exec(query),
    prefixKinds: Record<string, EntityKind> = {
      i: "issues",
      p: "projects",
      u: "users",
      t: "teams",
      l: "labels",
      f: "favorites",
      d: "documents",
    };
  const searchQuery = prefix ? prefix[2] : query,
    search = useQuickMatches(
      searchQuery,
      prefix
        ? [prefixKinds[prefix[1].toLowerCase()]]
        : ["issues", "projects", "documents"],
    );
  const contextualDefaults = contextualPaletteItems(availableCommands, {
    issueCount: targetedIssues.length,
    issueLabel: currentIssue
      ? currentIssue.identifier + " ⋅ " + currentIssue.title
      : undefined,
    issueDetail: !!currentIssue,
    projects: !!projectCollection || routeEntity?.[1] === "project",
    projectCount: !issueList ? projectCount : 0,
    projectLabel: currentProject?.name,
    assignedToMe:
      targetedIssues.length > 0 &&
      targetedIssues.every((issue) => issue.assigneeId === store.user?.id),
    teamLabel: contextTeam?.name,
    teamOverview: !!overviewTeam,
    teamFavorite: !!teamFavorite,
  });
  const results = query
    ? [
        ...(!prefix
          ? availableCommands.filter((command) =>
              command.label.toLowerCase().includes(query.toLowerCase()),
            )
          : []),
        ...search.nodes
          .filter((hit) => hit.kind !== "favorites" || hit.type !== "folder")
          .map((hit) => quickItem(hit, store, navigate)),
      ]
    : contextualDefaults;
  const shownResults =
    query && !results.length && !search.loading
      ? [
          {
            label: "No results found · Go to advanced search",
            icon: "Search",
            shortcut: "",
            action: () =>
              navigate(`/search?${new URLSearchParams({ q: searchQuery })}`),
          },
        ]
      : results;
  const run = (i: number) => {
    const result = shownResults[i];
    if (result) {
      flushSync(onClose);
      result.action();
    }
  };
  return (
    <Modal
      onClose={onClose}
      className="command-palette workspace-command-palette"
    >
      <div className="command-input">
        <Icon name="Search" size={18} />
        <input
          autoFocus
          aria-label="Command menu"
          aria-controls="quick-results"
          aria-haspopup="listbox"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          aria-activedescendant={
            shownResults[index] ? `quick-result-${index}` : undefined
          }
          onKeyDown={(event) =>
            quickNavigation(event, shownResults.length, index, setIndex, run)
          }
        />
        <span className="native-visually-hidden" role="status">
          {query ? `${shownResults.length} items` : "Showing all items"}
        </span>
      </div>
      {query ? (
        <QuickResults
          items={shownResults}
          index={index}
          setIndex={setIndex}
          run={run}
          label={prefix ? prefixKinds[prefix[1].toLowerCase()] : "Results"}
          loading={search.loading}
          offline={search.offline}
        />
      ) : (
        <div
          className="command-results"
          id="quick-results"
          role="listbox"
          aria-label="Commands"
        >
          {contextualDefaults.map((item, i, items) => (
            <React.Fragment key={item.label}>
              {(!i || items[i - 1].section !== item.section) && (
                <div className="menu-label" role="presentation">
                  {item.section}
                </div>
              )}
              <button
                id={"quick-result-" + i}
                type="button"
                role="option"
                aria-selected={index === i}
                className={"menu-item " + (index === i ? "selected" : "")}
                style={{ width: "100%" }}
                onMouseMove={() => setIndex(i)}
                onClick={() => run(i)}
                ref={(node) => {
                  if (node && index === i)
                    node.scrollIntoView({ block: "nearest" });
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <PaletteKeycaps shortcut={item.shortcut} />
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </Modal>
  );
}

const SearchPage = React.lazy(() =>
  import("./search").then((module) => ({ default: module.SearchPage })),
);

function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const store = useAppStore(),
    navigate = useNavigate();
  const [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Create or join a workspace" onClose={onClose}>
      <JoinAvailableWorkspaces onJoined={onClose} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await apiRequest("/auth/workspaces", {
              method: "POST",
              body: JSON.stringify({ name }),
            });
            await store.reload();
            navigate("/my-issues");
            onClose();
          } catch (error) {
            setError(String(error));
            setBusy(false);
          }
        }}
      >
        <div className="modal-body">
          <label className="field">
            <span>Workspace name</span>
            <input
              className="input"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim() || busy}
          >
            Create workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const InitiativeSavedViewPage = React.lazy(() =>
  import("./features/initiative-views").then((module) => ({
    default: module.InitiativeSavedViewPage,
  })),
);

function SavedViewRoute() {
  const { viewId } = useParams();
  const store = useAppStore();
  const view = store.data.views.find((v) => v.id === viewId && !v.deletedAt);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    setFailure(null);
    if (view || !viewId || store.initialSyncing) return;
    let cancelled = false;
    void store.loadEntity("views", viewId).catch(() => {
      if (!cancelled) setFailure(viewId);
    });
    return () => {
      cancelled = true;
    };
  }, [viewId, !!view, store.initialSyncing, store.data.workspaceId]);
  if (!view)
    return failure === viewId ? (
      <EmptyState
        icon="ListFilter"
        title="View not found"
        description="This view may have been deleted or you may not have access."
        action={
          <Link className="button" to="/views">
            Back to views
          </Link>
        }
      />
    ) : (
      <div className="app-loading">Loading view…</div>
    );
  return view.entityType === "initiatives" ? (
    <InitiativeSavedViewPage />
  ) : view.entityType === "projects" ? (
    <ProjectViewPage />
  ) : (
    <IssueList />
  );
}
