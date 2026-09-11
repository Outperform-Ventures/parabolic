import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./ui";
import { useAppStore } from "../store";
import "../features/entity-icon.css";
import "../features/reaction-emoji.css";
const ReactionEmoji = React.lazy(() => import("../features/reaction-emoji"));
export function EmojiGlyph({ emoji }: { emoji: string }) {
  const { data } = useAppStore(),
    custom = data.workspaces
      .find((workspace) => workspace.id === data.workspaceId)
      ?.customEmojis?.find((item: any) => `custom:${item.id}` === emoji);
  return custom ? (
    <img
      className="custom-emoji-glyph"
      src={custom.url}
      alt={`:${custom.name}:`}
      title={`:${custom.name}:`}
    />
  ) : (
    <>{emoji}</>
  );
}
export function EmojiPicker({
  onSelect,
  label = "Add reaction",
  icon,
}: {
  onSelect: (emoji: string) => unknown;
  label?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const select = async (emoji: string) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const result = await onSelect(emoji);
      if (result === null || result === false)
        throw Error("Could not add reaction");
      close();
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not add reaction",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current!.getBoundingClientRect(),
        box = panel.current?.getBoundingClientRect();
      if (!box) return;
      setPosition({
        left: Math.floor(Math.max(8, Math.min(anchor.right-box.width, innerWidth - box.width - 8))),
        top: Math.floor(Math.max(
          8,
          Math.min(
            anchor.bottom + box.height + 5 < innerHeight
              ? anchor.bottom + 5
              : anchor.top - box.height - 5,
            innerHeight - box.height - 8,
          ),
        )),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {icon ?? <Icon name="Smile" size={14} />}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            className="entity-icon-menu reaction-emoji-menu"
            role="dialog"
            aria-label="Choose emoji"
            style={position}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
              event.stopPropagation();
            }}
          >
            <React.Suspense
              fallback={<div className="menu-empty" style={{height:320}}>Loading emoji…</div>}
            >
              <ReactionEmoji onSelect={select} />
            </React.Suspense>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
          </div>,
          trigger.current?.closest("dialog[open]") || document.body,
        )}
    </>
  );
}
