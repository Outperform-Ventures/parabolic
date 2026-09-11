import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { emojiCatalog as data, type EmojiEntry as Emoji } from "./emoji-data";
import {
  Clock,
  Smile,
  Flower2,
  Apple,
  Trophy,
  Plane,
  Lightbulb,
  Heart,
  Flag,
} from "lucide-react";
import { useAppStore } from "../store";
import { Icon } from "../components/ui";
const names: Record<string, string> = {
  frequent: "Frequently used",
  people: "Smileys & People",
  nature: "Animals & Nature",
  foods: "Food & Drink",
  activity: "Activity",
  places: "Travel & Places",
  objects: "Objects",
  symbols: "Symbols",
  flags: "Flags",
  custom: "Custom",
};
const symbols: Record<string, string> = {
  frequent: "Clock",
  people: "Smile",
  nature: "Flower2",
  foods: "Apple",
  activity: "Trophy",
  places: "Plane",
  objects: "Lightbulb",
  symbols: "Heart",
  flags: "Flag",
  custom: "Smile",
};
const glyphs: Record<string, React.ElementType> = {
  Clock,
  Smile,
  Flower2,
  Apple,
  Trophy,
  Plane,
  Lightbulb,
  Heart,
  Flag,
};
const standardEntries = data.emojis;
export default function EntityEmoji({
  onSelect,
}: {
  onSelect: (emoji: string) => Promise<unknown>;
}) {
  const store = useAppStore(),
    key = `parabolic:emojis:${store.data.workspaceId}:${store.user?.id}`;
  const workspace = store.data.workspaces.find(
    (workspace) => workspace.id === store.data.workspaceId,
  );
  const customEmojis = useMemo(
    () =>
      Array.isArray(workspace?.customEmojis)
        ? workspace.customEmojis.filter((emoji: any) => !emoji.deletedAt)
        : [],
    [workspace?.customEmojis],
  );
  const entries = useMemo<Record<string, Emoji>>(
    () => ({
      ...standardEntries,
      ...Object.fromEntries(
        customEmojis.map((emoji: any) => [
          `custom:${emoji.id}`,
          {
            id: `custom:${emoji.id}`,
            name: emoji.name,
            keywords: [emoji.name, "custom"],
            skins: [{ native: `custom:${emoji.id}` }],
            url: emoji.url,
          },
        ]),
      ),
    }),
    [customEmojis],
  );
  const [query, setQuery] = useState(""),
    [skin, setSkin] = useState(() =>
      Number(localStorage.getItem(key + ":skin") || 0),
    ),
    [frequent, setFrequent] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem(key) || "[]");
      } catch {
        return [];
      }
    }),
    [busy, setBusy] = useState(false);
  const scroll = useRef<HTMLDivElement>(null),
    pendingCategory = useRef<string | null>(null),
    [focused, setFocused] = useState("");
  const groups = useMemo(() => {
    const aliases = data.aliases as Record<string, string>;
    const needle = query.toLowerCase().trim();
    const found = needle
      ? Object.values(entries)
          .filter(
            (e) =>
              [e.id, e.name, ...e.keywords]
                .join(" ")
                .toLowerCase()
                .includes(needle) || aliases[needle] === e.id,
          )
          .sort((a, b) => {
            const rank = (emoji: Emoji) =>
              emoji.id === needle || aliases[needle] === emoji.id
                ? 0
                : emoji.name.toLowerCase() === needle
                  ? 1
                  : emoji.id.startsWith(needle) ||
                      emoji.name.toLowerCase().startsWith(needle)
                    ? 2
                    : 3;
            return rank(a) - rank(b);
          })
          .map((e) => e.id)
      : null;
    return found
      ? found.length
        ? [{ id: "results", emojis: found }]
        : []
      : [
          {
            id: "frequent",
            emojis: frequent.filter((id) => entries[id]).slice(0, 24),
          },
          ...data.categories,
          {
            id: "custom",
            emojis: customEmojis.map((emoji: any) => `custom:${emoji.id}`),
          },
        ].filter((group) => group.emojis.length);
  }, [query, frequent, entries, customEmojis]);
  const rows = useMemo(
    () =>
      groups.flatMap((group) => [
        { type: "heading" as const, id: group.id, ids: [] as string[] },
        ...Array.from(
          { length: Math.ceil(group.emojis.length / 8) },
          (_, index) => ({
            type: "items" as const,
            id: group.id,
            ids: group.emojis.slice(index * 8, index * 8 + 8),
          }),
        ),
      ]),
    [groups],
  );
  const list = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroll.current,
    estimateSize: (index) => (rows[index].type === "heading" ? 27 : 34),
    overscan: 3,
  });
  useEffect(() => {
    if (!pendingCategory.current) return;
    const index = rows.findIndex((row) => row.id === pendingCategory.current);
    pendingCategory.current = null;
    if (index >= 0) list.scrollToIndex(index, { align: "start" });
  }, [rows]);
  const visibleRows = list.getVirtualItems();
  useEffect(() => {
    if (!focused) return;
    scroll.current
      ?.querySelector<HTMLElement>(`[data-emoji="${CSS.escape(focused)}"]`)
      ?.focus({ preventScroll: true });
  }, [focused, visibleRows[0]?.index, visibleRows.at(-1)?.index]);
  const select = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await onSelect(
        entries[id].skins[skin]?.native || entries[id].skins[0].native,
      );
      if (result !== false) {
        const next = [id, ...frequent.filter((item) => item !== id)].slice(
          0,
          32,
        );
        setFrequent(next);
        localStorage.setItem(key, JSON.stringify(next));
      }
    } finally {
      setBusy(false);
    }
  };
  const focus = (id: string) => {
    setFocused(id);
    const row = rows.findIndex((row) => row.ids.includes(id));
    if (row >= 0) list.scrollToIndex(row, { align: "auto" });
    requestAnimationFrame(() =>
      scroll.current
        ?.querySelector<HTMLElement>(`[data-emoji="${CSS.escape(id)}"]`)
        ?.focus(),
    );
  };
  const move = (event: React.KeyboardEvent, id: string) => {
    const all = rows.flatMap((row) => row.ids),
      index = all.indexOf(id);
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    ) {
      event.preventDefault();
      const offset =
        event.key === "ArrowLeft"
          ? -1
          : event.key === "ArrowRight"
            ? 1
            : event.key === "ArrowUp"
              ? -8
              : 8;
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? all.length - 1
            : Math.max(0, Math.min(all.length - 1, index + offset));
      focus(all[next]);
    }
  };
  return (
    <div className="entity-emoji-picker">
      <div className="entity-icon-search">
        <Icon name="Search" size={14} />
        <input
          autoFocus
          aria-label="Search emoji"
          placeholder="Search emoji…"
          value={query}
          onChange={(e) => {
            setFocused("");
            setQuery(e.target.value);
            scroll.current?.scrollTo({ top: 0 });
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              const first = rows.find((row) => row.ids.length)?.ids[0];
              if (first) focus(first);
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const first = rows.find((row) => row.ids.length)?.ids[0];
              if (first) void select(first);
            }
          }}
        />
        <select
          aria-label="Emoji skin tone"
          value={skin}
          onChange={(event) => {
            setSkin(Number(event.target.value));
            localStorage.setItem(key + ":skin", event.target.value);
          }}
        >
          {["👋", "👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿"].map((value, index) => (
            <option key={index} value={index}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <nav aria-label="Emoji categories">
        {Object.keys(names)
          .filter((id) => id !== "custom" || customEmojis.length)
          .map((id) => (
            <button
              key={id}
              type="button"
              title={names[id]}
              aria-label={names[id]}
              onClick={() => {
                setFocused("");
                pendingCategory.current = id;
                setQuery("");
                if (!query) {
                  const index = rows.findIndex((row) => row.id === id);
                  if (index >= 0) list.scrollToIndex(index, { align: "start" });
                  pendingCategory.current = null;
                }
              }}
            >
              {React.createElement(glyphs[symbols[id]], {
                size: 15,
                strokeWidth: 1.6,
                "aria-hidden": true,
              })}
            </button>
          ))}
      </nav>
      <div
        className="entity-emoji-scroll"
        ref={scroll}
        role="group"
        aria-label="Emoji grid"
      >
        <div style={{ height: list.getTotalSize(), position: "relative" }}>
          {visibleRows.map((row) => {
            const item = rows[row.index];
            return (
              <div
                key={row.key}
                className={
                  item.type === "heading"
                    ? "entity-emoji-heading"
                    : "entity-icon-grid"
                }
                style={{
                  position: "absolute",
                  top: row.start,
                  left: 0,
                  width: "100%",
                  height: row.size,
                }}
              >
                {item.type === "heading"
                  ? names[item.id] || "Search results"
                  : item.ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        data-emoji={id}
                        disabled={busy}
                        tabIndex={
                          focused === id ||
                          (!focused &&
                            rows.find((row) => row.ids.length)?.ids[0] === id)
                            ? 0
                            : -1
                        }
                        aria-label={entries[id].name}
                        title={`:${id}:`}
                        onFocus={() => setFocused(id)}
                        onKeyDown={(event) => move(event, id)}
                        onClick={() => void select(id)}
                      >
                        {entries[id].url ? (
                          <img
                            className="custom-emoji-glyph"
                            src={entries[id].url}
                            alt=""
                          />
                        ) : (
                          entries[id].skins[skin]?.native ||
                          entries[id].skins[0].native
                        )}
                      </button>
                    ))}
              </div>
            );
          })}
        </div>
        {!rows.length && <div className="menu-empty">No emoji found</div>}
      </div>
    </div>
  );
}
