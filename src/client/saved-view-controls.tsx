import React from "react";
import type { Entity } from "../shared/types";
import { useAppStore } from "./store";
import { EntityIconPicker } from "./features/entity-icon";
import "./saved-view-controls.css";

export function SavedViewIconPicker({ view }: { view: Entity }) {
  const store = useAppStore();
  return (
    <span className="saved-view-icon-picker">
      <EntityIconPicker
        compact
        label="Choose icon"
        fallback="CustomView"
        size={16}
        icon={view.icon}
        color={view.color}
        onChange={(appearance) => store.update("views", view.id, appearance)}
      />
    </span>
  );
}
