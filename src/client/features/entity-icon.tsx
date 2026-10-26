import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/ui";
import { ColorSpectrum } from "./color-spectrum";
import { isEmojiIcon } from "./color-model";
import { EmojiGlyph } from "../components/emoji-picker";
const EntityEmoji = React.lazy(() => import("./entity-emoji"));
import "./entity-icon.css";
import {useEntityColor} from "./entity-color";
// Native 16px team glyphs observed in the icon picker; SVG source recorded in the workspace-reference audit.
const teamGlyphs: Record<string, React.ReactNode> = {
  Shop: (<><path d="M3 1.5h10l2 4v1a2 2 0 0 1-3.5 1.32 2.5 2.5 0 0 1-3.5-.1 2.5 2.5 0 0 1-3.5.1A2 2 0 0 1 1 6.5v-1z"/><path d="M2 9a3.5 3.5 0 0 0 2.5-.2 4 4 0 0 0 3.5-.1 4 4 0 0 0 3.5.1A3.5 3.5 0 0 0 14 9v4.5a1 1 0 0 1-1 1h-3v-4H6v4H3a1 1 0 0 1-1-1z"/></>),
  Estimate: (<path fillRule="evenodd" clipRule="evenodd" d="M3.741 14.5h8.521c1.691 0 2.778-1.795 1.993-3.293l-4.26-8.134c-.842-1.608-3.144-1.608-3.986 0l-4.26 8.134C.962 12.705 2.05 14.5 3.74 14.5ZM8 3.368a.742.742 0 0 0-.663.402l-4.26 8.134A.75.75 0 0 0 3.741 13H8V3.367Z"/>),
  CustomView: (<><path d="M6.932 2.214a2.77 2.77 0 0 1 2.282.066l5.066 2.467c.944.46.964 1.812.034 2.3L9.287 9.683a2.77 2.77 0 0 1-2.574 0L1.686 7.047c-.93-.488-.91-1.84.034-2.3L6.786 2.28zm1.62 1.457a1.26 1.26 0 0 0-.97-.057l-.133.057-4.61 2.243 4.576 2.398c.367.193.803.193 1.17 0l4.574-2.398z"/><path d="M13.905 10.077c.367-.173.82-.044 1.01.288s.048.74-.32.912L9.5 13.67a3.56 3.56 0 0 1-2.998 0l-5.097-2.392-.066-.034c-.318-.188-.432-.567-.253-.878s.588-.444.941-.317l.07.029 5.096 2.391.195.078c.461.156.978.13 1.42-.078z"/></>),
  Stadium: (<path d="M4.5 4.575V1.282c0-.156.126-.282.282-.282.144 0 .287.027.42.08L7.5 2 5 3v1.42a10.9 10.9 0 0 1 5.5-.13V1.283c0-.156.126-.282.282-.282.144 0 .287.027.42.08L13.5 2 11 3v1.42c.666.19 1.323.444 1.962.761a.07.07 0 0 1 .038.067V7c0 .328-.31.567-.63.494a19.6 19.6 0 0 0-8.74 0A.513.513 0 0 1 3 7V5.25c0-.03.015-.056.038-.068q.719-.357 1.462-.606M1 9.427v5.1c0 .261.224.473.5.473h4a.5.5 0 0 0 .5-.5v-.848c0-1.086.261-2.315 1.317-2.573Q7.621 11.002 8 11c.252 0 .48.03.683.08C9.739 11.336 10 12.565 10 13.652v.847a.5.5 0 0 0 .5.5h4c.276 0 .5-.212.5-.473v-5.1a.08.08 0 0 0-.053-.077 18.55 18.55 0 0 0-13.894 0A.08.08 0 0 0 1 9.427"/>),
  Bolt: (<path fillRule="evenodd" d="M8.397 1.482a1.501 1.501 0 0 1 2.594 1.184L10.677 5.5H12.5a1.5 1.5 0 0 1 1.102 2.518l-6 6.5a1.5 1.5 0 0 1-2.593-1.184l.314-2.834H3.5a1.5 1.5 0 0 1-1.103-2.518zM3.5 9H7l-.5 4.5 6-6.5H9l.5-4.5z" clipRule="evenodd"/>),
  Surfer: (<path d="M7.25 3.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5M3.579 6.544h2.287c.76 0 1.489-.3 2.026-.835l.319-.317.748.745a.574.574 0 0 1-.41.983H6.495c-.785 0-1.186.91-1.506 1.638l-.428.971a4 4 0 0 0-.215.595 20 20 0 0 1 1.737-.676l.135-.264.137-.266.096-.192c.183-.375.32-.654.55-.654l.723.8.058.065q.731-.193 1.39-.321l-.382-.544h1.49a1.402 1.402 0 0 0 1.257-2.023l-1.01-2.009.426.141a2.76 2.76 0 0 1 1.748 1.74l.091.27a1 1 0 0 1 .051.314v.415a.578.578 0 0 0 1.157 0v-.45q0-.126-.03-.248l-.197-.78a3.5 3.5 0 0 0-1.597-2.145 3.52 3.52 0 0 0-3.37-.129l-.067.033a3.6 3.6 0 0 0-.946.679l-.6.596a2.46 2.46 0 0 1-1.737.716H3.58a.577.577 0 0 0-.58.576c0 .318.26.576.579.576M1 13.342c.243-.419 1.611-2.183 6.26-3.542 4.648-1.358 7.097-.684 7.74-.177-.124.905-1.63 3.082-6.666 4.555-5.035 1.472-6.935.637-7.256.036z"/>),
};
export const entityIcons = [
  "Shop",
  "CustomView",
  "Stadium",
  "Bolt",
  "Surfer",
  "Box",
  "Layers",
  "Folder",
  "FolderOpen",
  "FileText",
  "Target",
  "Flag",
  "Diamond",
  "Star",
  "Zap",
  "Flame",
  "Globe",
  "Building2",
  "Users",
  "User",
  "Code2",
  "GitBranch",
  "Workflow",
  "Webhook",
  "Plug",
  "Shield",
  "Lock",
  "KeyRound",
  "BookOpen",
  "Mail",
  "MessageSquare",
  "Bell",
  "Calendar",
  "Clock",
  "Timer",
  "BarChart3",
  "LayoutDashboard",
  "LayoutGrid",
  "LayoutList",
  "ListChecks",
  "CheckCircle2",
  "Circle",
  "Triangle",
  "Hash",
  "Tag",
  "Link",
  "Smile",
  "Sun",
  "Moon",
  "Palette",
  "ImageIcon",
  "Paperclip",
  "Inbox",
  "Home",
  "Menu",
  "List",
  "ListOrdered",
  "CheckSquare",
  "Pencil",
  "Trash2",
  "Archive",
  "Eye",
  "EyeOff",
  "Pin",
  "Repeat",
  "RefreshCw",
  "Undo2",
  "Send",
  "Upload",
  "Search",
  "Filter",
  "SlidersHorizontal",
  "Settings",
  "Command",
  "MoreHorizontal",
  "EllipsisVertical",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUpRight",
  "ArrowDownWideNarrow",
  "ArrowUpNarrowWide",
  "ChevronUp",
  "ChevronDown",
  "ChevronLeft",
  "ChevronRight",
  "ChevronFirst",
  "ChevronLast",
  "Check",
  "CheckCheck",
  "Plus",
  "X",
  "Percent",
  "AtSign",
  "ContactRound",
  "UserCircle",
  "FolderPlus",
  "FolderMinus",
  "FolderInput",
  "CalendarDays",
  "ChartNoAxesColumn",
  "ChartNoAxesColumnIncreasing",
  "SquareCode",
  "Banknote",
  "Text",
  "AlignLeft",
  "Heading1",
  "Quote",
  "Table2",
  "Bold",
  "Italic",
  "Strikethrough",
  "Type",
  "Underline",
  "GripVertical",
  "Maximize2",
  "Minimize2",
  "PanelLeft",
  "PanelRight",
  "WifiOff",
  "HelpCircle",
  "Unlock",
  "LogOut",
];
const colors = [
  "#5e6ad2",
  "#8d87dd",
  "#c26ee8",
  "#df64a5",
  "#e06a6a",
  "#ed9253",
  "#dcb653",
  "#6eb57c",
  "#4eaaa2",
  "#5b9cd5",
  "#9096a4",
  "#c5c8d0",
];
const compactColors = [
  ["Grey", "#c5c8d0"],
  ["Dark Grey", "#9096a4"],
  ["Purple", "#8d87dd"],
  ["Teal", "#4eaaa2"],
  ["Green", "#6eb57c"],
  ["Yellow", "#dcb653"],
  ["Orange", "#ed9253"],
  ["Pink", "#df64a5"],
  ["Red", "#e06a6a"],
] as const;
export function EntityIcon({
  entity,
  fallback = "Box",
  size = 16,
}: {
  entity?: Record<string, any>;
  fallback?: string;
  size?: number;
}) {
  const color = useEntityColor(entity?.color || "#8d87dd");
  const glyph = teamGlyphs[entity?.icon || fallback];
  // Effort is a fixed-size UI symbol across rows, totals, menus and previews.
  const effort = (entity?.icon || fallback) === "Estimate";
  const glyphSize = effort ? 16 : size;
  if (glyph) return <svg className="icon" aria-hidden="true" data-entity-icon={entity?.icon || fallback} width={glyphSize} height={glyphSize} viewBox="0 0 16 16" fill="currentColor" style={{ color, flexShrink: 0, ...(effort ? { width: 16, height: 16 } : {}) }}>{glyph}</svg>;
  if (entity?.icon?.startsWith("custom:"))
    return (
      <span
        className="icon emoji-icon"
        style={{ display: "inline-flex", width: size, height: size }}
      >
        <EmojiGlyph emoji={entity.icon} />
      </span>
    );
  return (
    <Icon
      name={entity?.icon || fallback}
      size={size}
      style={{ color }}
    />
  );
}
export function EntityIconPicker({
  icon,
  color,
  onChange,
  label = "Change icon",
  fallback = "Box",
  size = 24,
  compact = false,
}: {
  icon?: string;
  color?: string;
  onChange: (value: { icon: string; color: string }) => unknown;
  label?: string;
  fallback?: string;
  size?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<"icons" | "emojis">("icons"),
    [query, setQuery] = useState(""),
    [draft, setDraft] = useState(color || "#8d87dd"),
    [customOpen, setCustomOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    search = useRef<HTMLInputElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const save = async (value: { icon: string; color: string }) => {
    if (!/^#[0-9a-f]{6}$/i.test(value.color)) {
      setError("Enter a six-digit hexadecimal color.");
      return false;
    }
    setBusy(true);
    setError("");
    try {
      const result = await onChange(value);
      if (result === null) throw Error("Could not update the icon");
      setDraft(value.color);
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update the icon",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect(),
        width = menu.current?.offsetWidth || (compact ? 412 : 284),
        height = menu.current?.offsetHeight || 375;
      setPosition({
        left:
          rect.left + width + 8 <= innerWidth
            ? rect.left
            : Math.max(8, rect.right - width),
        top:
          rect.bottom + height + 8 < innerHeight
            ? rect.bottom + 6
            : Math.max(8, rect.top - height - 6),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (menu.current) observer.observe(menu.current);
    const frame = requestAnimationFrame(() => {
      place();
      search.current?.focus();
    });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", pointer, true);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="entity-icon-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setDraft(color || "#8d87dd");
          setTab(
            isEmojiIcon(icon) || icon?.startsWith("custom:")
              ? "emojis"
              : "icons",
          );
          setQuery("");
          setCustomOpen(false);
          setOpen(!open);
        }}
      >
        <EntityIcon entity={{ icon, color }} fallback={fallback} size={size} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            className={`entity-icon-menu${compact ? " entity-icon-menu-compact" : ""}`}
            role="dialog"
            aria-label={label}
            style={position}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
              } else if (
                event.key === "Enter" &&
                event.target === search.current
              ) {
                event.preventDefault();
                const value = entityIcons.find((name) =>
                  name.toLowerCase().includes(query.toLowerCase()),
                );
                if (value) void save({ icon: value, color: color || draft });
              } else if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key,
                ) &&
                event.target instanceof HTMLElement &&
                event.target.dataset.icon
              ) {
                event.preventDefault();
                const items = Array.from(
                  menu.current!.querySelectorAll<HTMLButtonElement>(
                    "[data-icon]",
                  ),
                );
                const offset =
                  event.key === "ArrowLeft"
                    ? -1
                    : event.key === "ArrowRight"
                      ? 1
                      : event.key === "ArrowUp"
                        ? -8
                        : 8;
                items[
                  (items.indexOf(event.target as HTMLButtonElement) +
                    offset +
                    items.length) %
                    items.length
                ]?.focus();
              }
              event.stopPropagation();
            }}
          >
            <div
              className="entity-icon-tabs"
              role="tablist"
              aria-label="Icon type"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "icons"}
                onClick={() => setTab("icons")}
              >
                Icons
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "emojis"}
                onClick={() => setTab("emojis")}
              >
                Emojis
              </button>
              <span className="spacer" />
              <button
                type="button"
                className="icon-button"
                aria-label="Close icon picker"
                onClick={close}
              >
                <Icon name="X" size={14} />
              </button>
            </div>
            {tab === "emojis" ? (
              <React.Suspense
                fallback={<div className="menu-empty">Loading emoji…</div>}
              >
                <EntityEmoji
                  onSelect={(emoji) =>
                    save({ icon: emoji, color: color || "#8d87dd" })
                  }
                />
              </React.Suspense>
            ) : (
              <>
                {!compact && <ColorSpectrum
                  color={draft}
                  onPreview={setDraft}
                  onChange={(value) =>
                    void save({ icon: icon || fallback, color: value })
                  }
                />}
                <div className="entity-icon-search">
                  <Icon name="Search" size={14} />
                  <input
                    ref={search}
                    placeholder="Search icons…"
                    aria-label="Search icons"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div
                  className="entity-color-grid"
                  role="group"
                  aria-label="Preset colors"
                >
                  {(compact
                    ? compactColors
                    : colors.map((value) => [value, value] as const)
                  ).map(([name, value]) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={compact ? name : "Color " + value}
                      aria-pressed={color === value}
                      style={{ background: value }}
                      onClick={() =>
                        void save({ icon: icon || fallback, color: value })
                      }
                    />
                  ))}
                  {compact && (
                    <button
                      type="button"
                      className="entity-custom-color-trigger"
                      aria-label="Set custom color"
                      aria-expanded={customOpen}
                      onClick={() => setCustomOpen((value) => !value)}
                    />
                  )}
                </div>
                <div
                  className="entity-icon-grid"
                  role="group"
                  aria-label="Preset icons"
                >
                  {entityIcons
                    .filter((name) =>
                      name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((name) => (
                      <button
                        key={name}
                        type="button"
                        data-icon={name}
                        aria-label={"Choose " + name + " icon"}
                        onMouseDown={(event) => event.preventDefault()}
                        aria-pressed={(icon || fallback) === name}
                        disabled={busy}
                        onClick={() =>
                          void save({ icon: name, color: color || draft })
                        }
                      >
                        <EntityIcon entity={{ icon: name, color: color || draft }} size={19} />
                      </button>
                    ))}
                </div>
                {(!compact || customOpen) && <div className="entity-icon-custom">
                  <label>
                    Custom color
                    <input
                      aria-label="Custom icon color"
                      value={draft}
                      maxLength={7}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void save({ icon: icon || fallback, color: draft });
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void save({ icon: icon || fallback, color: draft })
                    }
                  >
                    Apply
                  </button>
                </div>}
              </>
            )}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </div>,
          trigger.current?.closest("dialog[open]") || document.body,
        )}
    </>
  );
}
