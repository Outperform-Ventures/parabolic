import { SidebarDocs } from "./sidebar-docs";
import { SidebarChoice } from "./sidebar-choice";
import { useSidebarDestinations } from "./sidebar-destinations";
import React, { useState, useRef, useSyncExternalStore } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAppStore, patchUserPreferences } from "./store";
import {
  commentDraftKey,
  commentDraftSnapshot,
  subscribeCommentDrafts,
  parseCommentDrafts,
} from "./comment-drafts";
import { Dropdown, Icon, MenuItem, Modal } from "./components/ui";
import { IssueActionFilter } from "./issue-action-filter";
import { IssueActionSubmenu } from "./issue-action-submenu";
import {
  NativeSidebarIcon,
  isNativeSidebarIconName,
} from "./components/sidebar-icons";
import { NativeSidebarDisclosure } from "./components/lower-sidebar-icons";
import { draftKey, readDrafts, subscribeDrafts, draftSnapshot } from "./drafts";
import "./sidebar-navigation.css";
import { SidebarShortcut, sidebarNavigationShortcuts } from './sidebar-shortcuts';

type Entry = {
  label: string;
  path: string;
  icon: string;
  personal?: boolean;
  defaultVisibility?: string;
};
export const sidebarEntries: Entry[] = [
  { label: "Inbox", path: "/inbox", icon: "Inbox", personal: true },
  {
    label: "My issues",
    path: "/my-issues",
    icon: "CheckCheck",
    personal: true,
  },
  {
    label: "Drafts",
    path: "/drafts",
    icon: "FileText",
    personal: true,
    defaultVisibility: "badge",
  },
  { label: "Initiatives", path: "/initiatives", icon: "Layers" },
  { label: "Projects", path: "/projects", icon: "Box" },
  { label: "Teams", path: "/teams", icon: "Users" },
  { label: "Views", path: "/views", icon: "Layers" },
  { label: "Dashboards", path: "/dashboards", icon: "LayoutDashboard", defaultVisibility: "always" },
  {
    label: "Members",
    path: "/members",
    icon: "Users",
    defaultVisibility: "hidden",
  },
  {
    label: "Customers",
    path: "/customers",
    icon: "Building2",
    defaultVisibility: "always",
  },
];
export function SidebarNavigation({
  inboxBadge,
  canRoute,
  guest,
  workspace,
  settingsEntry = false,
  onOpenTab,
}: {
  settingsEntry?: boolean;
  inboxBadge: number;
  canRoute: (path: string) => boolean;
  guest: boolean;
  workspace: any;
  onOpenTab?: (route: string) => void;
}) {
  const store = useAppStore(),
    location = useLocation(),
    navigate = useNavigate(),
    [customize, setCustomize] = useState(false),
    [dragging, setDragging] = useState<string | null>(null),
    [context, setContext] = useState<{
      entry: Entry;
      x: number;
      y: number;
      nonce: number;
    } | null>(null);
  const remembered = useSidebarDestinations();
  const user = store.data.users.find((u) => u.id === store.user?.id),
    preferences = user?.preferences || {},
    scope = store.user?.id + ":" + store.data.workspaceId;
  const prefs = preferences.sidebar?.[store.data.workspaceId] || {};
  const patch = (change: Record<string, unknown>) => {
    if (user)
      void patchUserPreferences(user.id, {
        sidebar: { [store.data.workspaceId]: change },
      }).catch((e) => store.toast(e.message));
  };
  const key = draftKey(store.user?.id || "", store.data.workspaceId);
  useSyncExternalStore(subscribeDrafts, () => draftSnapshot(key));
  const commentsKey = commentDraftKey(
    store.user?.id || "",
    store.data.workspaceId,
  );
  const commentsSnapshot = useSyncExternalStore(subscribeCommentDrafts, () =>
    commentDraftSnapshot(commentsKey),
  );
  const commentCount = parseCommentDrafts(commentsSnapshot).filter((d) =>
    store.data.issues.some((i) => i.id === d.issueId && !i.deletedAt),
  ).length;
  const counts: Record<string, number> = {
    "/inbox": inboxBadge,
    "/drafts": readDrafts(key).length + commentCount,
  };
  const entries = sidebarEntries.filter(
    (e) =>
      canRoute(e.path) &&
      (e.path !== "/initiatives" || workspace?.initiativesEnabled !== false) &&
      (e.path !== "/customers" || workspace?.customersEnabled !== false),
  );
  const ordered = (personal: boolean) =>
    entries
      .filter((e) => !!e.personal === personal)
      .sort((a, b) => {
        const order: string[] =
          prefs.order || sidebarEntries.map((e) => e.path);
        return (
          (order.indexOf(a.path) < 0 ? 999 : order.indexOf(a.path)) -
          (order.indexOf(b.path) < 0 ? 999 : order.indexOf(b.path))
        );
      });
  const active = (e: Entry) =>
    location.pathname === e.path || location.pathname.startsWith(e.path + "/");
  const visibility = (e: Entry) =>
    prefs.visibility?.[e.path] || e.defaultVisibility || "always";
  const visible = (e: Entry) =>
    visibility(e) === "always" ||
    active(e) ||
    (visibility(e) === "badge" && counts[e.path] > 0);
  const reorder = (from: string, to: string) => {
    const source = entries.find((e) => e.path === from),
      target = entries.find((e) => e.path === to);
    if (!source || !target || !!source.personal !== !!target.personal) return;
    const order = [...ordered(true), ...ordered(false)]
      .map((e) => e.path)
      .filter((p) => p !== from);
    order.splice(order.indexOf(to), 0, from);
    patch({ order });
  };
  const glyph = (e: Entry) =>
    isNativeSidebarIconName(e.label) ? (
      <NativeSidebarIcon name={e.label} />
    ) : (
      <Icon name={e.icon} size={16} />
    );
  const link = (e: Entry) => (
    <NavLink
      key={e.path}
      to={remembered.destination(e.path)}
      aria-label={e.label}
      aria-description={sidebarNavigationShortcuts[e.path] ? `Shortcut: G then ${sidebarNavigationShortcuts[e.path]}` : undefined}
      className="sidebar-link"
      data-sidebar-path={e.path}
      draggable
      onContextMenu={(event) => {
        event.preventDefault();
        setContext({
          entry: e,
          x: event.clientX,
          y: event.clientY,
          nonce: Date.now(),
        });
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/sidebar-navigation", e.path);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("text/sidebar-navigation"))
          event.preventDefault();
      }}
      onDrop={(event) => {
        const from = event.dataTransfer.getData("text/sidebar-navigation");
        if (from) {
          event.preventDefault();
          reorder(from, e.path);
        }
      }}
    >
      {glyph(e)}
      <span className="sidebar-label">{e.label}</span>
      {counts[e.path] > 0 && (
        <span
          className={`sidebar-count ${prefs.badgeStyle === "dot" ? "sidebar-badge-dot" : ""}`}
          aria-label={`${counts[e.path]} ${e.label === "Drafts" ? "drafts" : "unread notifications"}`}
        >
          {prefs.badgeStyle === "dot" ? "" : counts[e.path]}
        </span>
      )}
      <SidebarShortcut path={e.path} />
    </NavLink>
  );
  return (
    <>
      {settingsEntry && (
        <button className="button" onClick={() => setCustomize(true)}>
          Customize
        </button>
      )}
      <nav style={settingsEntry ? { display: "none" } : undefined}>
        {ordered(true).filter(visible).map(link)}
        <button
          className="sidebar-section-title"
          aria-expanded={!prefs.workspaceCollapsed}
          onClick={() =>
            patch({ workspaceCollapsed: !prefs.workspaceCollapsed })
          }
        >
          Workspace
          <NativeSidebarDisclosure expanded={!prefs.workspaceCollapsed} />
        </button>
        {!prefs.workspaceCollapsed && (
          <>
            {ordered(false).filter(visible).map(link)}
            {!guest && (
              <Dropdown
                trigger={
                  <button
                    className="sidebar-link sidebar-more"
                    aria-label="More workspace views"
                  >
                    <Icon name="MoreHorizontal" size={16} />
                    <span>More</span>
                  </button>
                }
              >
                <div className="sidebar-menu-content">
                  {ordered(false)
                    .filter((e) => !visible(e))
                    .map((e) => (
                      <MenuItem
                        key={e.path}
                        icon={e.icon}
                        onClick={() => navigate(e.path)}
                      >
                        {e.label}
                      </MenuItem>
                    ))}
                  <div className="menu-separator" />
                  <MenuItem icon="Settings2" onClick={() => setCustomize(true)}>
                    Customize sidebar
                  </MenuItem>
                </div>
              </Dropdown>
            )}
          </>
        )}
      </nav>
      {context && (
        <Dropdown
          key={context.nonce}
          position={{ x: context.x, y: context.y }}
          trigger={<span />}
          onOpenChange={(open) => {
            if (open) return;
            const path = context.entry.path;
            setContext(null);
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLElement>(
                  `[data-sidebar-path="${CSS.escape(path)}"]`,
                )
                ?.focus(),
            );
          }}
        >
          <IssueActionFilter status searchLabel="Filter sidebar actions">
            <IssueActionSubmenu label="Visibility" icon="Eye" filter={false}>
              {[
                { value: "always", label: "Always show" },
                ...(["Inbox", "Drafts"].includes(context.entry.label)
                  ? [{ value: "badge", label: "Show when badged" }]
                  : []),
                ...(context.entry.label !== "Inbox"
                  ? [{ value: "hidden", label: "Don't show" }]
                  : []),
              ].map((option) => (
                <MenuItem
                  key={option.value}
                  icon={
                    visibility(context.entry) === option.value
                      ? "Check"
                      : undefined
                  }
                  onClick={() =>
                    patch({
                      visibility: {
                        ...prefs.visibility,
                        [context.entry.path]: option.value,
                      },
                    })
                  }
                >
                  {option.label}
                </MenuItem>
              ))}
            </IssueActionSubmenu>
            <MenuItem icon="Settings2" onClick={() => setCustomize(true)}>
              Customize sidebar
            </MenuItem>
            <MenuItem
              icon="Link"
              onClick={() => {
                const url = new URL(
                  remembered.destination(context.entry.path),
                  window.location.origin,
                ).href;
                const operation = window.desktop?.copyText
                  ? window.desktop.copyText(url)
                  : navigator.clipboard.writeText(url);
                void operation
                  .then(() => store.toast("Link copied"))
                  .catch((error) => store.toast(error.message));
              }}
            >
              Copy link
            </MenuItem>
            <MenuItem
              icon="ExternalLink"
              onClick={() =>
                onOpenTab?.(remembered.destination(context.entry.path))
              }
              disabled={!onOpenTab}
            >
              Open in new tab
            </MenuItem>
          </IssueActionFilter>
        </Dropdown>
      )}
      {customize && (
        <Modal
          title="Customize sidebar"
          className="sidebar-customize"
          onClose={() => setCustomize(false)}
        >
          <div className="sidebar-customize-body">
            <label className="sidebar-customize-badge">
              Default badge style
              <SidebarChoice
                label="Default badge style"
                value={prefs.badgeStyle || "count"}
                preview
                options={[
                  { value: "count", label: "Count" },
                  { value: "dot", label: "Dot" },
                ]}
                onChange={(badgeStyle) => patch({ badgeStyle })}
              />
            </label>
            {[true, false].map((personal) => (
              <section key={String(personal)}>
                <h3>{personal ? "Personal" : "Workspace"}</h3>
                <div className="sidebar-customize-group">
                  {ordered(personal).map((e) => (
                    <div
                      className={`sidebar-customize-row ${dragging === e.path ? "dragging" : ""}`}
                      key={e.path}
                      draggable
                      onDragStart={(event) => {
                        setDragging(e.path);
                        event.dataTransfer.setData(
                          "text/sidebar-navigation",
                          e.path,
                        );
                      }}
                      onDragEnd={() => setDragging(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        reorder(
                          event.dataTransfer.getData("text/sidebar-navigation"),
                          e.path,
                        );
                        setDragging(null);
                      }}
                    >
                      <button
                        className="sidebar-reorder-handle"
                        aria-label={`Reorder ${e.label}`}
                        title="Drag to reorder. Use arrow keys to move."
                        onKeyDown={(event) => {
                          if (!["ArrowUp", "ArrowDown"].includes(event.key))
                            return;
                          event.preventDefault();
                          const items = ordered(personal),
                            i = items.findIndex((item) => item.path === e.path),
                            j = i + (event.key === "ArrowUp" ? -1 : 1);
                          if (j < 0 || j >= items.length) return;
                          if (j < i) reorder(e.path, items[j].path);
                          else reorder(items[j].path, e.path);
                        }}
                      >
                        <Icon name="GripVertical" size={14} />
                      </button>
                      {glyph(e)}
                      <span>{e.label}</span>
                      <SidebarChoice
                        label={`${e.label} visibility`}
                        value={visibility(e)}
                        options={[
                          { value: "always", label: "Always show" },
                          ...(["Inbox", "Drafts"].includes(e.label)
                            ? [{ value: "badge", label: "Show when badged" }]
                            : []),
                          ...(e.label !== "Inbox"
                            ? [{ value: "hidden", label: "Don't show" }]
                            : []),
                        ]}
                        onChange={(value) =>
                          patch({
                            visibility: {
                              ...prefs.visibility,
                              [e.path]: value,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
export function SidebarHelp({
  onHelp,
  onShortcuts,
}: {
  onHelp: () => void;
  onShortcuts: () => void;
}) {
  const navigate = useNavigate(),
    [query, setQuery] = useState(""),
    [docs, setDocs] = useState(false);
  const openExternal = (url: string) => {
    if (window.desktop) void window.desktop.openExternal(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  };
  const items = [
    { label: "Docs", icon: "BookOpen", action: () => setDocs(true) },
    { label: "Contact us", icon: "MessageCircle", action: onHelp },
    {
      label: "Keyboard shortcuts",
      icon: "Command",
      shortcut: "⌘ /",
      action: onShortcuts,
    },
    {
      label: "Parabolic status",
      icon: "Activity",
      action: () => openExternal("https://status.parabolic.app"),
    },
    {
      label: "Download apps",
      icon: "Download",
      action: () => openExternal("https://parabolic.app/download"),
    },
    {
      label: "Settings",
      icon: "Settings",
      shortcut: "G then S",
      action: () => navigate("/settings"),
    },
    {
      label: "Slack community",
      icon: "Users",
      action: () => openExternal("https://parabolic.app/join-slack"),
    },
  ];
  return (
    <>
      <Dropdown
        trigger={
          <button
            className="icon-button"
            aria-label="Help"
            onClick={() => setQuery("")}
          >
            <Icon name="HelpCircle" size={16} />
          </button>
        }
      >
        <div className="sidebar-menu-content">
          <input
            data-keep-open
            autoFocus
            className="sidebar-help-search"
            placeholder="Help with…"
            aria-label="Help with…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                e.currentTarget.parentElement
                  ?.querySelector<HTMLButtonElement>("[role=menuitem]")
                  ?.focus();
              }
            }}
          />
          {items
            .filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
            .map((i) => (
              <MenuItem
                key={i.label}
                icon={i.icon}
                shortcut={i.shortcut}
                onClick={i.action}
              >
                {i.label}
              </MenuItem>
            ))}
          {!items.some((i) =>
            i.label.toLowerCase().includes(query.toLowerCase()),
          ) && <p className="muted">No results</p>}
        </div>
      </Dropdown>
      {docs && <SidebarDocs onClose={() => setDocs(false)} />}
    </>
  );
}

export function SidebarCustomizationButton() {
  const store = useAppStore();
  return (
    <SidebarNavigation
      settingsEntry
      inboxBadge={0}
      canRoute={() => true}
      guest={false}
      workspace={store.data.workspaces.find(
        (w) => w.id === store.data.workspaceId,
      )}
    />
  );
}
