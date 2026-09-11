import React from "react";
import { Link } from "react-router-dom";
import type { Entity } from "../shared/types";
import { useAppStore } from "./store";
import { Icon, StatusIcon } from "./components/ui";
import { issueName } from "./issues";

export function IssueRelations({ issue }: { issue: Entity }) {
  const store = useAppStore();
  const relations = (issue.relations ?? []) as {
    type: string;
    issueId: string;
  }[];
  const type = (value: string) =>
    ["blockedBy", "blocked_by"].includes(value)
      ? "blockedBy"
      : ["blocks", "blocking"].includes(value)
        ? "blocks"
        : value === "duplicate"
          ? "duplicate"
          : "related";
  return (
    <>
      {(["blockedBy", "blocks", "related", "duplicate"] as const).map(
        (kind) => {
          const items = relations.filter((r) => type(r.type) === kind);
          if (!items.length) return null;
          return (
            <section
              className={`issue-relation-group relation-${kind}`}
              key={kind}
            >
              <h3>
                {
                  {
                    blockedBy: "Blocked by",
                    blocks: "Blocks",
                    related: "Related",
                    duplicate: "Duplicates",
                  }[kind]
                }{" "}
                <span className="muted">{items.length}</span>
              </h3>
              {items.map((relation, index) => {
                const related = store.data.issues.find(
                    (i) => i.id === relation.issueId,
                  ),
                  status =
                    store.data.statuses.find(
                      (s) => s.id === related?.statusId,
                    ) ??
                    related?.sharedStatuses?.find(
                      (s: any) => s.id === related.statusId,
                    );
                return (
                  <div
                    className="relation-row"
                    key={`${relation.issueId}:${index}`}
                  >
                    <span
                      style={{
                        color:
                          kind === "blockedBy"
                            ? "#deaa53"
                            : kind === "blocks"
                              ? "#eb5757"
                              : undefined,
                      }}
                    >
                      <Icon
                        name={
                          kind === "related"
                            ? "Link"
                            : kind === "duplicate"
                              ? "Copy"
                              : "Flag"
                        }
                        size={13}
                      />
                    </span>
                    <Link to={`/issues/${relation.issueId}`}>
                      <small>{related ? issueName(related) : "Issue"}</small>
                      <span>{related?.title ?? "Related issue"}</span>
                    </Link>
                    <StatusIcon status={status} size={13} />
                    <button
                      className="icon-button"
                      aria-label={`Remove relation to ${related?.title ?? "issue"}`}
                      onClick={() =>
                        void store.update("issues", issue.id, {
                          relations: relations.filter((r) => r !== relation),
                        })
                      }
                    >
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                );
              })}
            </section>
          );
        },
      )}
    </>
  );
}
