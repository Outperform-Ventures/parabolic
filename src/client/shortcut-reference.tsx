import React, { useState } from "react";
import { Modal, TextInput } from "./components/ui";

/** Executable bindings from keyboard.ts and its connected handlers; excluded features are omitted. */
export const shortcutGroups: Record<string, [string, string][]> = {
  General: [
    ["Undo workspace change", "⌘ Z"],
    ["Redo workspace change", "⌘ ⇧ Z"],
    ["Open link from latest toast", "⌘ ⌥ O"],
    ["Command menu", "⌘ K"],
    ["Search workspace", "/"],
    ["Create issue", "C"],
    ["Create issue expanded", "V"],
    ["Create issue from template", "⌥ C"],
    ["Create project", "N then P"],
    ["Settings", "⌘ ,"],
    ["Keyboard shortcuts", "⌘ /"],
    ["Help menu", "?"],
    ["Toggle sidebar", "["],
    ["Toggle detail sidebar", "]"],
    ["Display options", "⇧ V"],
    ["Toggle issue view Insights", "⌘ ⇧ I"],
    ["Find in page", "⌘ F"],
    ["Next match", "⌘ G"],
    ["Previous match", "⌘ ⇧ G"],
    ["Back", "⌘ ["],
    ["Forward", "⌘ ]"],
    ["Copy page URL", "⌘ ⇧ C"],
    ["Log out", "⌥ ⇧ Q"],
  ],
  "Go to a view": [
    ["Inbox", "G then I"],
    ["My issues", "G then M"],
    ["Projects", "G then P"],
    ["Initiatives", "G then N"],
    ["Customers", "G then Q"],
    ["Dashboards", "G then −"],
    ["Drafts", "G then D"],
    ["Settings", "G then S"],
    ["Team triage", "G then T"],
    ["Team active issues", "G then A"],
    ["Team backlog", "G then B"],
    ["All team issues", "G then E"],
    ["Team archive", "G then X"],
    ["Team cycles", "G then C"],
    ["Current cycle", "G then V"],
    ["Upcoming cycle", "G then W"],
  ],
  "Open an item": [
    ["Issue", "O then I"],
    ["Project", "O then P"],
    ["Cycle", "O then C"],
    ["User’s issues", "O then U"],
    ["Team", "O then T"],
    ["View", "O then V"],
    ["Document", "O then D"],
    ["Initiative", "O then N"],
    ["Customer", "O then Q"],
    ["Favorite", "O then F"],
    ["Workspace", "O then W"],
  ],
  Issues: [
    ["Change status", "S"],
    ["Change assignee", "A"],
    ["Assign to me", "I"],
    ["Change priority", "P"],
    ["Change labels", "L"],
    ["Change estimate", "⇧ E"],
    ["Change due date", "⇧ D"],
    ["Remove due date", "⌘ ⇧ D"],
    ["Change project", "⇧ P"],
    ["Change cycle", "⇧ C"],
    ["Change milestone", "⇧ M"],
    ["Move to team", "⌘ ⇧ M"],
    ["Rename", "⇧ R"],
    ["Subscribe or unsubscribe", "⇧ S"],
    ["Manage subscribers", "⌘ ⇧ S"],
    ["Favorite", "⌥ F"],
    ["Remind me", "H"],
    ["Create sub-issue", "⌘ ⇧ O"],
    ["Change parent issue", "⌘ ⇧ P"],
    ["Open parent issue", "⌘ ⇧ ↑"],
    ["Open a sub-issue", "⌘ ⇧ ↓"],
    ["Focus description", "⌃ ⇧ I"],
    ["Focus comment", "⌃ M"],
    ["Reply to latest thread", "R"],
    ["Add URL link", "⌃ L"],
    ["Toggle links", "⌃ ⇧ L"],
    ["Apply template", "⌃ ⌥ ⇧ T"],
    ["Copy identifier", "⌘ ."],
    ["Copy URL", "⌘ ⇧ ,"],
    ["Copy title", "⌘ ⇧ ’"],
    ["Copy Markdown", "⌘ ⌥ C"],
    ["Delete", "⌘ Backspace"],
    ["Restore deleted issue", "#"],
  ],
  Triage: [
    ["Accept issue", "1"],
    ["Mark as duplicate", "2"],
    ["Decline issue", "3"],
    ["Snooze issue", "H"],
  ],
  "Issue relations": [
    ["Blocked by", "M then B"],
    ["Blocking", "M then X"],
    ["Related to", "M then R"],
    ["Duplicate of", "M then M"],
    ["Add customer request", "⌃ R (Windows/Linux: Ctrl Alt R)"],
  ],
  "Issue lists and boards": [
    ["Move focus", "↑ ↓ ← → or J / K"],
    ["Extend selection", "⇧ ↑ / ⇧ ↓"],
    ["Open focused issue", "Enter"],
    ["Peek at focused issue", "Space"],
    ["Select focused issue", "X"],
    ["Select all", "⌘ A"],
    ["Select group", "⌘ ⌥ A"],
    ["Clear selection", "Esc"],
    ["Toggle list or board", "⌘ B"],
    ["Add filter", "F"],
    ["Clear last filter", "⇧ F"],
    ["Clear filters", "⌥ ⇧ F"],
    ["Collapse or expand group", "T"],
    ["Collapse or expand all groups", "⌥ T"],
    ["Reorder up or down", "⌥ ↑ / ⌥ ↓"],
    ["Move to top or bottom", "⌥ ⇧ ↑ / ⌥ ⇧ ↓"],
    ["Move between board groups", "⌥ ← / ⌥ →"],
  ],
  "Projects and initiatives": [
    ["Project status", "P then S"],
    ["Project initiatives", "P then N"],
    ["Project lead", "P then A"],
    ["Project members", "P then M"],
    ["Project teams", "P then T"],
    ["Project labels", "P then L"],
    ["Initiative owner", "N then O"],
    ["Target date", "⌃ ⌥ D"],
    ["Project start date", "⌃ ⌥ S"],
    ["Open updates", "⌘ U"],
    ["Write update", "⌘ ⇧ U"],
    ["Favorite", "⌥ F"],
    ["Remind me", "H"],
    ["Copy URL", "⌘ ⇧ ,"],
    ["Copy title", "⌘ ⇧ ’"],
  ],
  Timeline: [
    ["Zoom in or out", "= / −"],
    ["Year scale", "Y"],
    ["Quarter scale", "Q"],
    ["Month scale", "M"],
    ["Week scale", "W"],
    ["Previous or next project", "← / →"],
    ["Toggle selected project", "X"],
    ["Select all", "⌘ A"],
    ["Select group", "⌘ ⌥ A"],
    ["Clear selection", "Esc"],
    ["Toggle project list", "⇧ ["],
  ],
  Inbox: [
    ["Previous or next notification", "↑ / ↓ or J / K"],
    ["Mark read or unread", "U"],
    ["Mark all read", "⌥ U"],
    ["Snooze selected notification", "H"],
    ["Delete selected notification", "Backspace"],
    ["Delete read notifications", "⇧ Backspace"],
  ],
  Tabs: [
    ["New tab", "⌘ T"],
    ["Close tab", "⌘ W"],
    ["Close other tabs", "⌘ ⌥ W"],
    ["Reopen closed tab", "⌘ ⇧ T"],
    ["Next tab", "⌃ Tab or ⌘ ⇧ ]"],
    ["Previous tab", "⌃ ⇧ Tab or ⌘ ⇧ ["],
    ["Select tab 1–8", "⌘ 1–8"],
    ["Select last tab", "⌘ 9"],
    ["Open tab picker", "⌘ ⇧ A"],
    ["Pin or unpin tab", "⌃ ⇧ P"],
    ["Select team 1–9", "⌃ ⇧ 1–9"],
  ],
  Editor: [
    ["Bold", "⌘ B"],
    ["Italic", "⌘ I"],
    ["Underline", "⌘ U"],
    ["Undo", "⌘ Z"],
    ["Redo", "⌘ ⇧ Z"],
    ["Insert block", "/"],
    ["Mention person or item", "@"],
    ["Emoji completion", ":name:"],
    ["Submit form or comment", "⌘ Enter"],
    ["Send comment with default preference", "Enter"],
    ["Comment line break", "⇧ Enter"],
  ],
};
export function ShortcutReference({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const referenceGroups = {
    General: shortcutGroups.General,
    Navigation: [
      ...shortcutGroups["Go to a view"],
      ...shortcutGroups["Open an item"],
    ],
    ...Object.fromEntries(
      Object.entries(shortcutGroups).filter(
        ([title]) =>
          !["General", "Go to a view", "Open an item"].includes(title),
      ),
    ),
  };
  const groups = Object.entries(referenceGroups)
    .map(
      ([title, items]) =>
        [
          title,
          items.filter(([label, binding]) =>
            `${title} ${label} ${binding}`.toLowerCase().includes(search),
          ),
        ] as const,
    )
    .filter(([, items]) => items.length);
  return (
    <Modal
      title="Keyboard Shortcuts"
      onClose={onClose}
      className="shortcuts-modal"
    >
      <div className="modal-body">
        <TextInput
          aria-label="Search shortcuts"
          placeholder="Search shortcuts"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {groups.map(([title, items]) => (
          <section key={title}>
            <h3>{title}</h3>
            {items.map(([name, key]) => (
              <div className="shortcut-row" key={name}>
                <span>{name}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </section>
        ))}
        {!groups.length && <p className="muted">No matching shortcuts</p>}
      </div>
    </Modal>
  );
}
