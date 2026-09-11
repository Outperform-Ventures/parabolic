import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest, useAppStore } from "./store";
import { openComposer } from "./issues";
import type { Entity, WorkspaceData } from "../shared/types";
export {issueDefaultsFromLink} from "./new-issue-defaults";
import {issueDefaultsFromLink,matchIssueLinkRecord as match} from "./new-issue-defaults";
export function NewIssueLink() {
  const store = useAppStore(),
    location = useLocation(),
    navigate = useNavigate(),
    { teamKey } = useParams();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !store.ready || store.initialSyncing) return;
    opened.current = true;
    void (async () => {
      const params = new URLSearchParams(location.search);
      let data = store.data;
      const templateKey = params.get("template");
      if (templateKey && !match(data.templates, templateKey)) {
        try {
          const result = await apiRequest(
            `/api/v1/templates/${encodeURIComponent(templateKey)}`,
          );
          data = { ...data, templates: [...data.templates, result] };
        } catch {
          store.toast(
            "This template is unavailable. You can still create an issue.",
          );
        }
      }
      const defaults = issueDefaultsFromLink(params, data, teamKey);
      const template = data.templates.find(template=>template.id===defaults.templateId);
      if (template) defaults.__template = template;
      navigate(
        defaults.teamId ? `/team/${defaults.teamId}/all` : "/my-issues",
        { replace: true },
      );
      requestAnimationFrame(() => openComposer(defaults));
    })();
  }, [store.ready, store.initialSyncing, teamKey, location.search]);
  return <div className="app-loading">Opening issue composer…</div>;
}
export function prefilledIssueUrl(issue: Entity, origin: string) {
  const params = new URLSearchParams();
  for (const [parameter, field] of Object.entries({
    title: "title",
    description: "description",
    status: "statusId",
    assignee: "assigneeId",
    cycle: "cycleId",
    estimate: "estimate",
    project: "projectId",
    projectMilestone: "milestoneId",
  }))
    if (issue[field] != null) params.set(parameter, String(issue[field]));
  params.set(
    "priority",
    ["none", "urgent", "high", "medium", "low"][issue.priority ?? 0],
  );
  if (issue.labelIds?.length) params.set("labels", issue.labelIds.join(","));
  return `${origin}/team/${encodeURIComponent(issue.teamId)}/new?${params}`;
}
