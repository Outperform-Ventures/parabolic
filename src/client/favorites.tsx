import {EntityIcon} from "./features/entity-icon";
import {StatusIcon} from "./components/ui";
import {labelViewRoute} from './label-view-route';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import type { Entity } from "../shared/types";
import { useAppStore } from "./store";
import {
  Button,
  Dropdown,
  Icon,
  MenuItem,
  Modal,
  TextInput,
} from "./components/ui";
import "./favorites.css";
import { NativeSidebarDisclosure } from "./components/lower-sidebar-icons";

const order = (a: Entity, b: Entity) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
  a.createdAt.localeCompare(b.createdAt) ||
  a.id.localeCompare(b.id);
const name = (item: Entity) => String(item.label ?? item.name ?? "Untitled");
const icon = (item: Entity) =>
  ({
    issue: "Circle",
    project: "Box",
    document: "FileText",
    initiative: "Layers",
    cycle: "CircleDashed",
    customer: "Building2",
    team: "Users",
    view: "ListFilter",
    label: "Tag",
    dashboard: "LayoutDashboard",
  })[item.type as string] ?? "Star";

/** Personal folders are favorites records, so ordering and membership synchronize with the sidebar. */
export function FavoritesSidebar({onOpenTab}:{onOpenTab:(route:string)=>void}) {
  const store = useAppStore();
  const [context,setContext]=useState<{item:Entity;x:number;y:number;nonce:number}|null>(null);
  const copyUrl=(item:Entity)=>perform(navigator.clipboard.writeText(new URL(item.route??`/issues/${item.entityId}`,location.origin).href));
  const label=(item:Entity)=>{const title=name(item);const team=item.section==='active'?store.data.teams.find(t=>t.id===item.entityId||String(item.route||'').includes('/'+t.id+'/')):undefined;return team&&title.endsWith(' '+team.name)?<>{title.slice(0,-team.name.length-1)}<span className="favorite-team-suffix">{team.name}</span></>:title;};
  const name = (item: Entity) => {const view=labelViewRoute(item.route,store.data);return view ? view.entity?.name ?? "Label unavailable" : String(item.label ?? item.name ?? "Untitled")};
  const [collapsed, setCollapsed] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [moving, setMoving] = useState<Entity | null>(null),
    [dropTarget, setDropTarget] = useState<string | null>(null);
  const saving = useRef(false),
    heading = useRef<HTMLButtonElement>(null);
  const items = useMemo(
    () =>
      store.data.favorites
        .filter(
          (item) =>
            !item.deletedAt && (!item.userId || item.userId === store.user?.id),
        )
        .sort(order),
    [store.data.favorites, store.user?.id],
  );
  const folders = items.filter((item) => item.type === "folder"),
    folderIds = new Set(folders.map((item) => item.id));
  const folderOf = (item: Entity) =>
    item.type !== "folder" && folderIds.has(item.folderId)
      ? item.folderId
      : null;
  const siblings = (folderId: string | null) =>
    items.filter((item) => folderOf(item) === folderId);
  const perform = (action: Promise<unknown>) => {
    void action.catch((reason) =>
      store.toast(
        reason instanceof Error ? reason.message : "Unable to update favorites",
      ),
    );
  };
  const move = async (
    id: string,
    folderId: string | null,
    beforeId?: string,
  ) => {
    if (id === beforeId) return;
    const item = items.find((row) => row.id === id);
    if (
      !item ||
      (item.type === "folder" && folderId) ||
      (folderId && !folderIds.has(folderId))
    )
      return;
    const rows = siblings(folderId).filter((row) => row.id !== id),
      before = rows.findIndex((row) => row.id === beforeId);
    rows.splice(before < 0 ? rows.length : before, 0, item);
    const operations = rows
      .map((row, index) => ({
        kind: "favorites" as const,
        action: "update" as const,
        id: row.id,
        data: { folderId, sortOrder: (index + 1) * 1024 },
      }))
      .filter((op) => {
        const old = items.find((row) => row.id === op.id)!;
        return (
          (old.folderId ?? null) !== folderId ||
          old.sortOrder !== op.data.sortOrder
        );
      });
    for (let index = 0; index < operations.length; index += 1000)
      await store.batch(operations.slice(index, index + 1000));
    if (folderId) {
      const folder = folders.find((row) => row.id === folderId);
      if (folder?.collapsed)
        await store.update("favorites", folderId, { collapsed: false });
    }
  };
  const shift = (item: Entity, direction: -1 | 1) => {
    const rows = siblings(folderOf(item)),
      index = rows.findIndex((row) => row.id === item.id),
      next = index + direction;
    if (next < 0 || next >= rows.length) return;
    perform(
      move(
        item.id,
        folderOf(item),
        direction < 0 ? rows[next].id : rows[next + 1]?.id,
      ),
    );
  };
  const removeFolder = async (folder: Entity) => {
    const children = items.filter((row) => row.folderId === folder.id),
      base = Math.max(0, ...siblings(null).map((row) => row.sortOrder ?? 0));
    // The server also unfiles children transactionally, including records not hydrated on this device.
    if (children.length < 1000)
      await store.batch([
        ...children.map((row, index) => ({
          kind: "favorites" as const,
          action: "update" as const,
          id: row.id,
          data: { folderId: null, sortOrder: base + (index + 1) * 1024 },
        })),
        { kind: "favorites", action: "delete", id: folder.id },
      ]);
    else await store.remove("favorites", folder.id);
  };
  const startEdit = (item?: Entity) => {
    setCollapsed(false);
    setEditing(item?.id ?? "new");
    setDraft(item ? name(item) : "");
    setError("");
  };
  const save = async (value: string) => {
    if (saving.current) return;
    const title = value.trim();
    if (!title) {
      setEditing(null);
      return;
    }
    if (title.length > 100) {
      setError("Use a folder name of 100 characters or fewer.");
      return;
    }
    saving.current = true;
    try {
      if (editing === "new")
        await store.create("favorites", {
          type: "folder",
          userId: store.user?.id,
          name: title,
          label: title,
          collapsed: false,
          sortOrder:
            Math.max(0, ...siblings(null).map((row) => row.sortOrder ?? 0)) +
            1024,
        });
      else if (editing)
        await store.update("favorites", editing, { name: title, label: title });
      setEditing(null);
      heading.current?.focus();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save folder",
      );
    } finally {
      saving.current = false;
    }
  };
  const editor = (
    <div className="favorite-folder-editor">
      <Icon name="Folder" size={15} />
      <input
        autoFocus
        aria-label="Folder name"
        placeholder="Folder name…"
        maxLength={100}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            void save(event.currentTarget.value);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setEditing(null);
            heading.current?.focus();
          }
        }}
      />
    </div>
  );
  const drag = (item: Entity) => ({
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/favorite-id", item.id);
    },
    onDragEnd: () => setDropTarget(null),
  });
  const drop = (key: string, folderId: string | null, beforeId?: string) => ({
    onDragOver: (event: React.DragEvent) => {
      if (event.dataTransfer.types.includes("text/favorite-id")) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setDropTarget(key);
      }
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null))
        setDropTarget(null);
    },
    onDrop: (event: React.DragEvent) => {
      const id = event.dataTransfer.getData("text/favorite-id");
      if (id) {
        event.preventDefault();
        event.stopPropagation();
        setDropTarget(null);
        const item = items.find((row) => row.id === id);
        perform(
          move(
            id,
            item?.type === "folder" ? null : folderId,
            item?.type === "folder" && folderId ? folderId : beforeId,
          ),
        );
      }
    },
  });
  const menu = (item: Entity) => (
    <Dropdown
      align="right"
      trigger={
        <button
          className="icon-button favorite-actions"
          aria-label={`Actions for ${name(item)}`}
        >
          <Icon name="MoreHorizontal" size={13} />
        </button>
      }
    >
      {item.type === "folder" ? (
        <MenuItem icon="Pencil" onClick={() => startEdit(item)}>
          Rename folder
        </MenuItem>
      ) : (
        <MenuItem icon="FolderInput" onClick={() => setMoving(item)}>
          Move to folder…
        </MenuItem>
      )}
      <MenuItem
        icon="ArrowUp"
        disabled={siblings(folderOf(item))[0]?.id === item.id}
        onClick={() => shift(item, -1)}
      >
        Move up
      </MenuItem>
      <MenuItem
        icon="ArrowDown"
        disabled={siblings(folderOf(item)).at(-1)?.id === item.id}
        onClick={() => shift(item, 1)}
      >
        Move down
      </MenuItem>
      <div className="menu-separator" />
      <MenuItem
        icon={item.type === "folder" ? "FolderMinus" : "X"}
        onClick={() =>
          perform(
            item.type === "folder"
              ? removeFolder(item)
              : store.remove("favorites", item.id),
          )
        }
      >
        {item.type === "folder"
          ? "Remove folder and keep favorites"
          : "Remove favorite"}
      </MenuItem>
    </Dropdown>
  );
  const favoriteEntity=(item:Entity)=>{const kind=item.entityKind||({issue:'issues',project:'projects',document:'documents',initiative:'initiatives',cycle:'cycles',customer:'customers',team:'teams',view:'views',label:'labels',dashboard:'dashboards'} as const)[item.type as string];const entity=kind&&Array.isArray((store.data as unknown as Record<string,Entity[]>)[kind])?(store.data as unknown as Record<string,Entity[]>)[kind].find((entity:Entity)=>entity.id===item.entityId):undefined;return entity?{...entity,...(item.section==='active'?{icon:'CircleDot'}:{}),...(item.icon?{icon:item.icon}:{}),...(item.color?{color:item.color}:{})}:item;};
  const row = (item: Entity) => (
    <div
      key={item.id}
      className={`favorite-row organized-favorite ${dropTarget === item.id ? "favorite-drop-before" : ""}`}
      data-favorite-id={item.id}
      onKeyDown={event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();const rect=event.currentTarget.getBoundingClientRect();setContext({item,x:rect.left+20,y:rect.bottom,nonce:Date.now()});}}}
      onContextMenu={event=>{event.preventDefault();setContext({item,x:event.clientX,y:event.clientY,nonce:Date.now()});}}
      {...drag(item)}
      {...drop(item.id, folderOf(item), item.id)}
    >
      <NavLink
        className="sidebar-link"
        to={item.route ?? `/issues/${item.entityId}`}
      >
        {item.section==='active'?<StatusIcon status={{...favoriteEntity(item),type:'started'}} size={15}/>:<EntityIcon entity={favoriteEntity(item)} fallback={labelViewRoute(item.route,store.data) ? "Tag" : icon(item)} size={15} />}
        <span>{label(item)}</span>
      </NavLink>
      <button
        className="icon-button favorite-remove"
        aria-label={`Remove favorite ${name(item)}`}
        onClick={() => perform(store.remove("favorites", item.id))}
      >
        <Icon name="X" size={11} />
      </button>
    </div>
  );
  useEffect(()=>{const open=()=>{setCollapsed(false);setEditing('new');setDraft('');setError('');};window.addEventListener('create-favorite-folder',open);return()=>window.removeEventListener('create-favorite-folder',open);},[]);
  if(!items.length&&!editing)return null;
  return (
    <section aria-label="Favorites" className="favorites-section">
      <div
        className={`sidebar-section-title favorite-section-heading ${dropTarget === "root" ? "favorite-drop-folder" : ""}`}
        {...drop("root", null)}
      >
        <button
          ref={heading}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          Favorites
          <NativeSidebarDisclosure expanded={!collapsed} />
        </button>
        <button
          className="icon-button"
          aria-label="Create new folder for favorites"
          onClick={() => startEdit()}
        >
          <Icon name="FolderPlus" size={13} />
        </button>
      </div>
      {!collapsed && (
        <div className="favorite-root" {...drop("root", null)}>
          {siblings(null).map((item) =>
            item.type !== "folder" ? (
              row(item)
            ) : (
              <div
                key={item.id}
                className={`favorite-folder ${dropTarget === item.id ? "favorite-drop-folder" : ""}`}
                data-favorite-folder-id={item.id}
              >
                {editing === item.id ? (
                  editor
                ) : (
                  <div
                    className="favorite-folder-heading"
                    {...drag(item)}
                    {...drop(item.id, item.id)}
                  >
                    <button
                      className="sidebar-link"
                      aria-expanded={!item.collapsed}
                      onClick={() =>
                        perform(
                          store.update("favorites", item.id, {
                            collapsed: !item.collapsed,
                          }),
                        )
                      }
                    >
                      <Icon
                        name={item.collapsed ? "ChevronRight" : "ChevronDown"}
                        size={11}
                      />
                      <Icon name="Folder" size={15} />
                      <span>{name(item)}</span>
                    </button>
                    {menu(item)}
                  </div>
                )}
                {!item.collapsed && (
                  <div
                    className="favorite-folder-children"
                    {...drop(item.id, item.id)}
                  >
                    {siblings(item.id).map(row)}
                    {!siblings(item.id).length && (
                      <div className="favorite-folder-empty">
                        Drag favorites here
                      </div>
                    )}
                  </div>
                )}
              </div>
            ),
          )}
          {editing === "new" && editor}
          {error && (
            <div className="favorite-error" role="alert">
              {error}
            </div>
          )}
        </div>
      )}
      {context&&<Dropdown key={context.nonce} position={{x:context.x,y:context.y}} trigger={<span/>}><div className="sidebar-menu-content"><MenuItem icon="Link" onClick={()=>copyUrl(context.item)}>Copy URL</MenuItem><MenuItem icon="ExternalLink" onClick={()=>onOpenTab(context.item.route??`/issues/${context.item.entityId}`)}>Open in new tab</MenuItem><div className="menu-separator"/><MenuItem icon="X" onClick={()=>perform(store.remove('favorites',context.item.id))}>Remove favorite</MenuItem></div></Dropdown>}
      {moving && (
        <MoveFavorite
          item={moving}
          folders={folders}
          folderId={folderOf(moving)}
          onClose={() => setMoving(null)}
          onMove={async (id) => {
            await move(moving.id, id);
            setMoving(null);
          }}
        />
      )}
    </section>
  );
}

function MoveFavorite({
  item,
  folders,
  folderId,
  onClose,
  onMove,
}: {
  item: Entity;
  folders: Entity[];
  folderId: string | null;
  onClose: () => void;
  onMove: (id: string | null) => Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const options = useRef<HTMLDivElement>(null);
  const navigate = (event: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(options.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []);
    if (!buttons.length) return;
    event.preventDefault(); event.stopPropagation();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (current + 1) % buttons.length : (current < 0 ? buttons.length - 1 : (current - 1 + buttons.length) % buttons.length);
    buttons[index].focus();
  };
  const choose = async (id: string | null) => {
    setBusy(true);
    try {
      await onMove(id);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to move favorite",
      );
      setBusy(false);
    }
  };
  return (
    <Modal title="Move favorite" onClose={onClose}>
      <div className="modal-body">
        <p className="muted">{name(item)}</p>
        <TextInput
          autoFocus
          aria-label="Find favorite folder"
          placeholder="Search folders…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") navigate(event); }}
        />
        <div ref={options} role="listbox" aria-label="Favorite folders" onKeyDown={navigate}>
          {!query && (
            <button
              className="menu-item"
              role="option"
              aria-selected={!folderId}
              disabled={busy}
              onClick={() => void choose(null)}
            >
              <Icon name="Star" />
              Favorites
            </button>
          )}
          {folders
            .filter((folder) =>
              name(folder).toLowerCase().includes(query.toLowerCase()),
            )
            .map((folder) => (
              <button
                key={folder.id}
                className="menu-item"
                role="option"
                aria-selected={folder.id === folderId}
                disabled={busy}
                onClick={() => void choose(folder.id)}
              >
                <Icon name="Folder" />
                {name(folder)}
              </button>
            ))}
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="modal-footer">
        <Button onClick={onClose}>Cancel</Button>
      </footer>
    </Modal>
  );
}
