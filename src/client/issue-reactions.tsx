import React from "react";
import type { Entity } from "../shared/types";
import { reactionUsers, toggleReaction } from "../shared/reactions";
import { useAppStore } from "./store";
import { EmojiGlyph, EmojiPicker } from "./components/emoji-picker";
import { displayNameFor } from "./display-name";
import { NativeIssueActionIcon } from "./components/issue-action-icons";
export function IssueReactions({ issue }: { issue: Entity }) {
  const store = useAppStore(),
    reactions = reactionUsers(issue.reactions);
  const toggle = (emoji: string) =>
    store.update("issues", issue.id, {
      reactions: toggleReaction(issue.reactions, emoji, store.user!.id),
    });
  return (
    <div className="issue-reactions" aria-label="Issue reactions">
      {Object.entries(reactions)
        .filter(([, users]) => users.length)
        .map(([emoji, users]) => (
          <button
            type="button"
            key={emoji}
            title={users
              .map((id) =>
                displayNameFor(
                  store.data.users.find((user) => user.id === id),
                  store.data,
                  "Member",
                ),
              )
              .join(", ")}
            aria-label={`React ${emoji}`}
            aria-pressed={users.includes(store.user!.id)}
            onClick={() => void toggle(emoji)}
          >
            <EmojiGlyph emoji={emoji} />
            {users.length}
          </button>
        ))}
      <EmojiPicker
        label="Add reaction"
        icon={<NativeIssueActionIcon name="reaction" />}
        onSelect={toggle}
      />
    </div>
  );
}
