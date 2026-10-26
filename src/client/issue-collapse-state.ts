import { useCallback, useMemo, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";

const changeEvent = "parabolic:issue-group-collapse";
// Keep the current session usable when browser storage is unavailable/full.
const unsaved = new Map<string, string>();

export function issueCollapseKey(displayKey: string, groupBy: string, subGroupBy = "none") {
  return `${displayKey}:collapsed-groups:${JSON.stringify([groupBy, subGroupBy || "none"])}`;
}

export function parseCollapsedGroups(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string"))]
      : [];
  } catch {
    return [];
  }
}

function read(key: string): string | null {
  if (unsaved.has(key)) return unsaved.get(key)!;
  try { return localStorage.getItem(key); } catch { return null; }
}

function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener("storage", notify);
  };
}

/** Personal presentation state, separate from shared/saved view definitions. */
export function useIssueGroupCollapse(
  displayKey: string,
  groupBy: string,
  subGroupBy: string,
): [string[], Dispatch<SetStateAction<string[]>>] {
  const key = issueCollapseKey(displayKey, groupBy, subGroupBy);
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const collapsed = useMemo(() => parseCollapsedGroups(raw), [raw]);
  const setCollapsed = useCallback<Dispatch<SetStateAction<string[]>>>((update) => {
    const previous = parseCollapsedGroups(read(key));
    const next = typeof update === "function" ? update(previous) : update;
    const serialized = JSON.stringify([...new Set(next)]);
    // Persist during the action, not a later effect: navigation/unmount cannot
    // lose the toggle or write the previous view's state into the next view.
    try {
      localStorage.setItem(key, serialized);
      unsaved.delete(key);
    } catch {
      unsaved.set(key, serialized);
    }
    window.dispatchEvent(new Event(changeEvent));
  }, [key]);
  return [collapsed, setCollapsed];
}
