import {NativeIssueActionGlyph,nativeIssueActionGlyphs} from './issue-menu-glyphs';
import {isCompositionKey} from '../composition-key';
import {NativePriorityGlyph, NativeStatusGlyph} from './issue-icons';
import {userDisplayName} from '../display-name';
import { useAppStore } from "../store";
import { CalendarInput } from "./calendar";
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChartNoAxesColumn,
  CircleDashed,
  FolderPlus,
  FolderMinus,
  FolderInput,
  MailOpen,
  Pause,
  UserRound,
  CircleUserRound,
  ContactRound,
  ListFilter,
  Pencil,
  Triangle,
  GitBranch,
  Tag,
  Flame,
  Search,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  MoreHorizontal,
  Inbox,
  Circle,
  CheckCircle2,
  Settings,
  Layers,
  Folder,
  FolderOpen,
  FileText,
  Calendar,
  Users,
  User,
  Hash,
  Flag,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Filter,
  SlidersHorizontal,
  LayoutList,
  LayoutGrid,
  LayoutDashboard,
  PanelLeft,
  PanelRight,
  Command,
  Clock,
  Star,
  Copy,
  Trash2,
  Archive,
  Link,
  ExternalLink,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Bell,
  BellOff,
  LogOut,
  Globe,
  Sun,
  Moon,
  Palette,
  Target,
  Diamond,
  BarChart3,
  ChartNoAxesColumnIncreasing,
  Workflow,
  Code2,
  SquareCode,
  KeyRound,
  Webhook,
  Plug,
  Zap,
  Shield,
  Building2,
  Banknote,
  Text,
  Mail,
  Upload,
  RefreshCw,
  Undo2,
  Send,
  Maximize2,
  Minimize2,
  MessageSquare,
  History,
  AlignLeft,
  Heading1,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Table2,
  ImageIcon,
  Bold,
  Italic,
  Strikethrough,
  Type,
  Underline,
  GripVertical,
  ArrowUpRight,
  Box,
  ChevronFirst,
  ChevronLast,
  WifiOff,
  Home,
  Move,
  Repeat,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Unlock,
  Pin,
  CheckSquare,
  Minus,
  Menu,
  BookOpen,
  AtSign,
  Timer,
  Percent,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  EllipsisVertical,
} from "lucide-react";
import type { Entity } from "../../shared/types";
const icons: Record<string, React.ComponentType<any>> = {
  CalendarDays,
  ChartNoAxesColumn,
  CircleDashed,
  FolderPlus,
  FolderMinus,
  FolderInput,
  MailOpen,
  Pause,
  UserRound,
  UserCircle: CircleUserRound,
  ContactRound,
  ListFilter,
  Pencil,
  Triangle,
  GitBranch,
  Tag,
  Flame,
  Search,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  MoreHorizontal,
  Inbox,
  Circle,
  CheckCircle2,
  Settings,
  Layers,
  Folder,
  FolderOpen,
  FileText,
  Calendar,
  Users,
  User,
  Hash,
  Flag,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Filter,
  SlidersHorizontal,
  LayoutList,
  LayoutGrid,
  LayoutDashboard,
  PanelLeft,
  PanelRight,
  Command,
  Clock,
  Star,
  Copy,
  Trash2,
  Archive,
  Link,
  ExternalLink,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Bell,
  BellOff,
  LogOut,
  Globe,
  Sun,
  Moon,
  Palette,
  Target,
  Diamond,
  BarChart3,
  ChartNoAxesColumnIncreasing,
  Workflow,
  Code2,
  SquareCode,
  KeyRound,
  Webhook,
  Plug,
  Zap,
  Shield,
  Building2,
  Banknote,
  Text,
  Mail,
  Upload,
  RefreshCw,
  Undo2,
  Send,
  Maximize2,
  Minimize2,
  MessageSquare,
  History,
  AlignLeft,
  Heading1,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Table2,
  ImageIcon,
  Bold,
  Italic,
  Strikethrough,
  Type,
  Underline,
  GripVertical,
  ArrowUpRight,
  Box,
  ChevronFirst,
  ChevronLast,
  WifiOff,
  Home,
  Move,
  Repeat,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Unlock,
  Pin,
  CheckSquare,
  Minus,
  Menu,
  BookOpen,
  AtSign,
  Timer,
  Percent,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  EllipsisVertical,
};
const aliases: Record<string, string> = {
  issues: "Circle",
  issue: "Circle",
  projects: "Box",
  project: "Box",
  initiatives: "Layers",
  initiative: "Layers",
  cycles: "Repeat",
  cycle: "Repeat",
  views: "Layers",
  document: "FileText",
  documents: "FileText",
  customers: "Building2",
  customer: "Building2",
  insights: "BarChart3",
  dashboard: "LayoutDashboard",
  dots: "MoreHorizontal",
  more: "MoreHorizontal",
  close: "X",
  status: "Circle",
  priority: "ChartNoAxesColumnIncreasing",
  assignee: "User",
  label: "Tag",
  team: "Users",
  trash: "Trash2",
};
export function Icon({
  name,
  size = 16,
  className = "",
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
  [key: string]: any;
}) {
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(name)) return <span className={`icon emoji-icon ${className}`} aria-hidden="true" {...props} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:size,width:size,height:size,lineHeight:1,...props.style}}>{name}</span>;
  if(nativeIssueActionGlyphs[name])return <NativeIssueActionGlyph name={name} size={size} className={className} {...props}/>;
  const key =
    aliases[name] ??
    Object.keys(icons).find(
      (k) => k.toLowerCase() === name.toLowerCase().replace(/[-_ ]/g, ""),
    ) ??
    name;
  const Component = icons[key] ?? Circle;
  return (
    <Component
      size={size}
      strokeWidth={1.6}
      className={`icon ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}
export function Button({
  variant,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger" | "ghost";
}) {
  return (
    <button
      type="button"
      className={`button ${variant ?? ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Avatar({
  user,
  size = 20,
}: {
  user?: Entity | null;
  size?: number;
}) {
  const store = useAppStore();
  const prefs =
    store.data.users.find((u) => u.id === store.user?.id)?.preferences ??
    store.user?.preferences;
  const label = userDisplayName(user,prefs);
  if (!user)
    return (
      <span className="avatar unassigned" style={{ width: size, height: size }}>
        <Icon name="User" size={size - 5} />
      </span>
    );
  return (
    <span
      className="avatar"
      data-tooltip-label={label}
      aria-label={label}
      style={{
        width: size,
        height: size,
        background: user.color ?? "#7564b6",
        fontSize: Math.max(8, size * 0.39),
      }}
    >
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} />
      ) : (
        String(user.name ?? "?")
          .trim().split(/\s+/).filter(Boolean)
          .filter((_part,index,parts)=>index===0||index===parts.length-1)
          .map((s) => s[0])
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}
export function Badge({
  children,
  color,
  description,
  className = "",
}: {
  children: ReactNode;
  color?: string;
  description?: string;
  className?: string;
}) {
  return (
    <span className={`badge ${className}`} data-tooltip={description||undefined}>
      {color && <i style={{ background: color }} />}
      {children}
    </span>
  );
}
export function StatusIcon({
  status,
  size = 16,
}: {
  status?: Entity | {type?:string;color?:string} | null;
  size?: number;
}) {
  const type = status?.type ?? "unstarted";
  return (
    <span
      className={`status-icon status-${type}`}
      style={{ width: size, height: size, color: status?.color ?? "#8b8b94" }}
    >
      {type === "completed" || type === "started" || type === "backlog" ? (
        <NativeStatusGlyph type={type} />
      ) : type === "canceled" ? (
        <Icon name="X" size={size - 3} />
      ) : (
        <span />
      )}
    </span>
  );
}
export function PriorityIcon({ priority = 0 }: { priority?: number }) {
  return (
    <span
      className={`priority-icon priority-${priority}`}
      data-tooltip-label={
        ["No priority", "Urgent", "High", "Medium", "Low"][priority] ??
        "No priority"
      }
    >
      <NativePriorityGlyph priority={priority} />
    </span>
  );
}
export function EmptyState({
  icon = "Inbox",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-illustration">
        <Icon name={icon} size={34} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Modal({
  title,
  titleContent,
  ariaLabel,
  onClose,
  children,
  wide = false,
  className = "",
  preserveCompositionEscape = false,
}: {
  title?: string;
  titleContent?: ReactNode;
  ariaLabel?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  preserveCompositionEscape?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const ownedFocusEvents = useRef(new WeakSet<Event>());
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const modal = ref.current;
    let focusedInside = modal?.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    const isTopDialog = () => Array.from(document.querySelectorAll("[role=dialog],dialog[open]")).at(-1) === modal;
    let compositionEscapeAt=-Infinity;
    const compositionEscape=(event:KeyboardEvent)=>{
      if(!preserveCompositionEscape||!isTopDialog()||event.key!=='Escape')return;
      if(isCompositionKey(event)){compositionEscapeAt=performance.now();return;}
      // macOS follows marked-text cancellation with a duplicate plain Escape.
      if(performance.now()-compositionEscapeAt<100){compositionEscapeAt=-Infinity;event.preventDefault();event.stopPropagation();modal?.focus({preventScroll:true});}
    };
    const focusInside = () => {
      const target = focusedInside?.isConnected && !focusedInside.hasAttribute("disabled")
        ? focusedInside
        : modal?.querySelector<HTMLElement>('[autofocus]') ?? modal?.querySelector<HTMLElement>('input:not([disabled]),textarea:not([disabled]),[contenteditable="true"]') ?? modal?.querySelector<HTMLElement>('button:not([disabled])');
      target?.focus();
    };
    // A lazily mounted background page may autofocus after this dialog opens.
    const containFocus = (event: FocusEvent) => {
      if (!isTopDialog()) return;
      if (modal?.contains(event.target as Node) || ownedFocusEvents.current.has(event) || (event.target as Element).closest?.('[data-global-focus-scope="true"]')) focusedInside = event.target as HTMLElement;
      else { event.stopPropagation(); focusInside(); }
    };
    const frame = requestAnimationFrame(() => {
      // React autofocus or a user interaction may have already placed focus.
      // A delayed frame must not steal it just before Enter submits a form.
      if (!modal || !isTopDialog() || modal.contains(document.activeElement) || document.activeElement?.closest('[data-global-focus-scope="true"]')) return;
      focusInside();
    });
    const key = (event: KeyboardEvent) => {
      if(isCompositionKey(event))return;
      if((event.target as Element).closest?.('[data-issue-submenu]')&&['Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      if (
        Array.from(document.querySelectorAll("[role=dialog],dialog[open]")).at(
          -1,
        ) !== ref.current
      )
        return;
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        close.current();
      }
      if (event.key === "Tab") {
        const all = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),textarea,select,[tabindex="0"],[contenteditable="true"]',
          ) ?? [],
        ).filter((e) => e.offsetParent !== null);
        const first = all[0],
          last = all.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("focusin", containFocus);
    document.addEventListener("keydown", compositionEscape,true);
    document.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", containFocus);
      document.removeEventListener("keydown", compositionEscape,true);
      document.removeEventListener("keydown", key);
      if (previousFocus.current?.isConnected && (modal?.contains(document.activeElement) || document.activeElement === document.body)) previousFocus.current.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""} ${className}`}
        role="dialog"
        tabIndex={preserveCompositionEscape?-1:undefined}
        aria-modal="true"
        aria-label={ariaLabel ?? title ?? "Dialog"}
        onFocusCapture={event => ownedFocusEvents.current.add(event.nativeEvent)}
      >
        {title && (
          <div className="modal-header">
            <h2>{titleContent ?? title}</h2>
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={onClose}
            >
              <Icon name="X" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function Dropdown({
  trigger,
  children,
  align = "left",
  className = "",
  menuClassName = "",
  alignOffset = 0,
  sideOffset = 5,
  position,
  onOpenChange,
  closeOnEnter = false,
  snapToPixels = false,
  trapFocus = false,
  onEnter,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  menuClassName?: string;
  alignOffset?: number;
  sideOffset?: number;
  position?: { x: number; y: number };
  onOpenChange?: (open:boolean)=>void;
  closeOnEnter?: boolean;
  snapToPixels?: boolean;
  trapFocus?: boolean;
  onEnter?: () => void;
}) {
  const [open, setOpen] = useState(!!position);
  useEffect(()=>{onOpenChange?.(open)},[open,onOpenChange]);
  const [menuSearch,setMenuSearch]=useState('');
  const menuSearchRef=useRef('');
  useEffect(()=>{if(!open){setMenuSearch('');menuSearchRef.current='';}},[open]);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState({ left: 8, top: 8 });
  const restoreFocus = () =>
    ref.current?.querySelector<HTMLElement>('button,[tabindex="0"]')?.focus();
  const [rect, setRect] = useState<
    DOMRect | { bottom: number; left: number; right: number } | undefined
  >(
    position
      ? { bottom: position.y, left: position.x, right: position.x + 240 }
      : undefined,
  );
  useLayoutEffect(() => {
    if (!open || !rect) return;
    const place = () => {
      const box = menu.current?.getBoundingClientRect();
      if (!box) return;
      const anchor = position
        ? rect
        : (ref.current?.getBoundingClientRect() ?? rect);
      const left = Math.max(
        8,
        Math.min(
          (align === "right" ? anchor.right - box.width : anchor.left) + alignOffset,
          innerWidth - box.width - 8,
        ),
      );
      const below = anchor.bottom + sideOffset,
        above =
          ("top" in anchor ? Number(anchor.top) : anchor.bottom) -
          box.height -
          sideOffset;
      const top = Math.max(
        8,
        Math.min(
          below + box.height <= innerHeight - 8
            ? below
            : above >= 8
              ? above
              : innerHeight - box.height - 8,
          innerHeight - 8,
        ),
      );
      const nextLeft = snapToPixels ? Math.floor(left) : left;
      const nextTop = snapToPixels ? Math.floor(top) : top;
      setPlacement((old) =>
        old.left === nextLeft && old.top === nextTop ? old : { left: nextLeft, top: nextTop },
      );
    };
    place();
    const observer = new ResizeObserver(place);
    if (menu.current) observer.observe(menu.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, rect, align, position, snapToPixels, alignOffset, sideOffset]);
  useLayoutEffect(()=>{if(open&&trapFocus&&rect)menu.current?.focus({preventScroll:true});},[open,trapFocus,!!rect]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (
        !ref.current?.contains(event.target as Node) &&
        !(event.target as Element).closest?.(".dropdown-content")
      )
        setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if(isCompositionKey(event))return;
      if(event.key==='Escape'){
        const shown=(element:HTMLElement)=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
        const escapeLayers=Array.from(document.querySelectorAll<HTMLElement>('[data-dropdown-escape-layer]')).filter(shown);
        if(escapeLayers.some(layer=>menu.current?.contains(layer)))return;
        const visibleMenus=Array.from(document.querySelectorAll<HTMLElement>('.dropdown-content')).filter(shown);
        if(visibleMenus.at(-1)!==menu.current)return;
      }
      if((event.target as HTMLElement).closest('.customer-status-menu')&&!menu.current?.contains(event.target as Node))return;
      if((event.target as HTMLElement).closest('.issue-action-filter')&&['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const editable=(event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]');
      // A customizable select owns Escape while its picker is open. Let the
      // browser cancel that picker before dismissing the containing menu.
      if(event.key==='Escape'&&editable instanceof HTMLSelectElement&&editable.matches(':open'))return;
      if(menu.current?.querySelector('.sidebar-menu-content')&&!editable&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&(event.key.length===1||event.key==='Backspace')){
        event.preventDefault();event.stopImmediatePropagation();
        const query=event.key==='Backspace'?menuSearchRef.current.slice(0,-1):menuSearchRef.current+event.key;
        menuSearchRef.current=query;setMenuSearch(query);
        const items=Array.from(menu.current.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
        for(const item of items)item.hidden=!item.textContent?.toLowerCase().includes(query.toLowerCase());
        for(const separator of menu.current.querySelectorAll<HTMLElement>('.menu-separator'))separator.hidden=!!query;
        const match=items.find(item=>!item.hidden&&!item.hasAttribute('disabled'));
        if(match)match.focus();else menu.current.focus();return;
      }
      if(menu.current?.querySelector('.sidebar-menu-content')&&!editable&&['Enter','ArrowDown','ArrowUp','Home','End'].includes(event.key)&&!menu.current.querySelector('[role^="menuitem"]:not([hidden]):not([disabled])')){event.preventDefault();event.stopImmediatePropagation();menu.current.focus();return;}
      if (event.key === "Escape" || (closeOnEnter && event.key === "Enter" && editable)) {
        if (event.key === "Enter") onEnter?.();
        event.preventDefault();
        if(event.key==='Escape')event.stopImmediatePropagation();else event.stopPropagation();
        setOpen(false);
        restoreFocus();
      }
      if (event.key === "Tab") {
        if(trapFocus){
          event.preventDefault();event.stopPropagation();
          const controls=Array.from(menu.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')??[]).filter(el=>el.offsetParent!==null);
          const index=controls.indexOf(document.activeElement as HTMLElement);
          const next=index<0?(event.shiftKey?controls.length-1:0):(index+(event.shiftKey?-1:1)+controls.length)%controls.length;
          (controls[next]??menu.current)?.focus();return;
        }
        setOpen(false);
        restoreFocus();
        return;
      }
      if (
        (event.target as HTMLElement).matches(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        if (event.altKey && (event.target as HTMLElement).closest('.section-reorder-handle')) return;
        const items = Array.from(
          menu.current?.querySelectorAll<HTMLElement>(
            '[role^="menuitem"]:not([disabled]):not([hidden])',
          ) ?? [],
        );
        if (!items.length) return;
        event.preventDefault();
        const idx = items.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : idx < 0
                ? event.key === "ArrowUp"
                  ? items.length - 1
                  : 0
                : (idx + (event.key === "ArrowDown" ? 1 : items.length - 1)) %
                  items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, closeOnEnter, onEnter, trapFocus]);
  return (
    <div ref={ref} className={`dropdown ${className}`}>
      <span
        className="dropdown-trigger"
        onClick={() => {
          setRect(ref.current?.getBoundingClientRect());
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (!open && ["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            setRect(ref.current?.getBoundingClientRect());
            setOpen(true);
            requestAnimationFrame(() => {
              const items = menu.current?.querySelectorAll<HTMLElement>(
                '[role^="menuitem"]:not([disabled])',
              );
              items?.[e.key === "ArrowUp" ? items.length - 1 : 0]?.focus();
            });
          }
        }}
      >
        {React.isValidElement(trigger)
          ? React.cloneElement(trigger as React.ReactElement<any>, {
              "aria-expanded": open,
              "aria-haspopup": "menu",
            })
          : trigger}
      </span>
      {open &&
        rect &&
        createPortal(
          <div
            ref={menu}
            tabIndex={-1}
            className={`menu dropdown-content ${menuClassName}`}
            role="menu"
            style={{
              position: "fixed",
              top: placement.top,
              left: placement.left,
              maxWidth: "calc(100vw - 16px)",
              maxHeight: "calc(100vh - 16px)",
              overflowY: "auto",
              overflowX: "hidden",
              zIndex: 100,
            }}
            onClick={(e) => {
              if ((e.target as Element).closest("[data-keep-open]")) return;
              setOpen(false);
            }}
          >
            {menuSearch&&<><div className="sidebar-menu-query" aria-live="polite">{menuSearch}</div>{!Array.from(menu.current?.querySelectorAll('[role^="menuitem"]')??[]).some(item=>!item.hasAttribute('hidden'))&&<div className="sidebar-menu-query" role="status">No results</div>}</>}
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
export function MenuItem({
  children,
  icon,
  shortcut,
  onClick,
  danger = false,
  disabled = false,
  searchOnly = false,
}: {
  children: ReactNode;
  icon?: string;
  shortcut?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  searchOnly?: boolean;
}) {
  return (
    <button
      className={`menu-item ${danger ? "danger" : ""}`}
      role="menuitem"
      data-search-only={searchOnly||undefined}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} />}
      <span>{children}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}
export function Field({
  label,
  children,
  description,
}: {
  label: string;
  children: ReactNode;
  description?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {description && <small>{description}</small>}
    </label>
  );
}
export const TextInput = (
  props: React.InputHTMLAttributes<HTMLInputElement>,
) => <input {...props} className={`input ${props.className ?? ""}`} />;
export const Select = (
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) => <select {...props} className={`input select ${props.className ?? ""}`} />;
export const DatePicker = CalendarInput;

const LazyEditor = React.lazy(() =>
  import("./editor").then((m) => ({ default: m.RichEditor })),
);
export function RichEditor(props: {
  issueFormatting?: boolean;
  templateMode?: boolean;
  dataOverride?: import("../../shared/types").WorkspaceData;
  uploadFile?: (file:File)=>Promise<{url:string}>;
  onUploadStatusChange?: (status:{pending:boolean;error:string})=>void;
  showAuthors?: boolean;
  showInlineComments?: boolean;
  blurOnEscape?: boolean;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  readOnly?: boolean;
  openLinkRequest?: number;
  collaboration?: import("../collaboration").CollaborationTarget;
  attachmentContext?: {
    issueId?: string;
    documentId?: string;
    projectId?: string;
    initiativeId?: string;
    commentId?: string;
  };
}) {
  return (
    <React.Suspense fallback={<div className="rich-editor-loading" />}>
      <LazyEditor {...props} />
    </React.Suspense>
  );
}
