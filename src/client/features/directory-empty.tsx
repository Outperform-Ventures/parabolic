import React from "react";
import { NativeSidebarIcon } from "../components/sidebar-icons";
import "./directory-empty.css";

const initiativeDescription =
  "Initiatives are larger, strategic product efforts that set the direction of your company. They are comprised of all projects that align with the goals of the initiative and allow you to monitor their progress at scale.";

export function DirectoryEmpty({
  kind,
  onCreate,
  filtered = false,
  model = "projects",
  emptyTitle,
  emptyDescription,
}: {
  kind: "views" | "initiatives";
  onCreate?: () => void;
  filtered?: boolean;
  model?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const initiative = kind === "initiatives";
  const title = filtered
    ? "No matching " + kind
    : emptyTitle || (initiative ? "Initiatives" : "Views");
  const description = filtered
    ? "Try adjusting your filters or search."
    : emptyDescription ||
      (initiative
        ? initiativeDescription
        : `Create custom views using filters to show only the ${model} you want to see. You can save, share, and favorite these views for easy access and faster team collaboration.`);
  return (
    <div className="directory-empty">
      <div className="directory-empty-art" aria-hidden="true">
        {!initiative ? (
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            {[0, 3, 6].map((y) => (
              <path
                key={y}
                transform={`translate(0 ${y})`}
                d="M4 49 34 34 64 48 64 57 35 72 4 58Z M4 49 35 64 64 48 M35 64v8"
              />
            ))}
            <path d="m4 42 19-32 31-4-18 33Z m0 0 3 3 31-4L57 9l-3-3" />
          </svg>
        ) : (
          [0, 1, 2].map((index) => (
            <div
              key={index}
              className="directory-empty-art-row"
              style={{ marginLeft: index === 1 ? 20 : 0 }}
            >
              <NativeSidebarIcon name="Initiatives" />
              <span />
              <i />
              <i />
            </div>
          ))
        )}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {!filtered && !initiative && (
        <p>
          You can also save any existing view by clicking the save view icon or
          by pressing ⌥ V.
        </p>
      )}
      {!filtered && (
        <div className="directory-empty-actions">
          {onCreate && (
            <button className="button primary" onClick={onCreate}>
              {initiative ? (
                <>
                  <span>Create new initiative</span>
                  <kbd>N, then I</kbd>
                </>
              ) : (
                "Create new view"
              )}
            </button>
          )}
          <a
            className="button"
            href={
              "https://parabolic.app/docs/" +
              (initiative ? "initiatives" : "custom-views")
            }
            target="_blank"
            rel="noreferrer"
          >
            Documentation
          </a>
        </div>
      )}
    </div>
  );
}
