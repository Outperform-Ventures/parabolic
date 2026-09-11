import {notificationDestination} from './notification-destination';
import {inboxNotificationTags} from './inbox-stacks';
import type { Entity, WorkspaceData } from "../shared/types";
import { displayNameFor } from "./display-name";
import { textContent } from "./query";

export function inboxPresentation(notification: Entity, data: WorkspaceData, knownIssue?: Entity | null) {
  const destination=notificationDestination(notification);
  const issue = destination.kind!=='issue'?undefined:knownIssue === undefined ? data.issues.find(issue => issue.id === notification.issueId) : knownIssue || undefined;
  const project = data.projects.find(project => project.id === (issue?.projectId || notification.projectId));
  const document = data.documents.find(document => document.id === notification.documentId);
  const initiative = data.initiatives.find(initiative => initiative.id === notification.initiativeId);
  const actor = data.users.find(user => user.id === notification.actorId);
  const name = displayNameFor(actor, data, "Someone");
  const reasons = [notification.type, ...(Array.isArray(notification.reasons) ? notification.reasons : [])].join(" ").toLowerCase();
  const tags=inboxNotificationTags(notification),has=(...names:string[])=>names.some(name=>tags.has(name));
  const body = textContent(notification.body || notification.message || "");
  let summary = body || notification.title || "Workspace update", icon = "Bell";
  if (has('viewissueadded','viewissueclosed')) {
    const view=data.views.find(view=>view.id===notification.viewId),label=view?.name||'a subscribed view';
    summary=has('viewissueclosed')?`${name} ${notification.viewEventStatus==='canceled'?'canceled':'completed'} the issue in ${label}`:`${name} added the issue to ${label}`;
    icon='Layers';
  } else if (reasons.includes("mention")) {
    summary = `${name} mentioned you${reasons.includes("comment") ? " in a comment" : ""}`;
    icon = "AtSign";
  } else if (has('documentcontentchange','documentcontentrevision','documentchanges')) {
    summary = `${name} edited the document`;icon = "Pencil";
  } else if (has('documentdeleted')) {
    summary = `${name} deleted the document`;icon = "Trash2";
  } else if (has('documentrestored')) {
    summary = `${name} restored the document`;icon = "FileText";
  } else if (has('documentmoved')) {
    summary = `${name} moved the document`;icon = "FolderInput";
  } else if (has('documentsubscribed')) {
    summary = `${name} subscribed you to the document`;icon = "Bell";
  } else if (has('documentunsubscribed')) {
    summary = `${name} unsubscribed you from the document`;icon = "BellOff";
  } else if (has('projectdescriptioncontentchange','initiativedescriptioncontentchange')) {
    summary = `${name} edited the ${has('projectdescriptioncontentchange')?'project':'initiative'} description`;icon = "Pencil";
  } else if (has('unassigned','issueunassignedfromyou')) {
    summary = `${name} unassigned you from the issue`;icon = "ArrowRight";
  } else if (reasons.includes("assigned")) {
    summary = `${name} assigned the issue to you`;
    icon = "ArrowRight";
  } else if (reasons.includes("updatereminder")) {
    summary = `${project ? "Project" : "Initiative"} update is due`;
    icon = "Clock";
  } else if (reasons.includes("reminder")) {
    summary = "You asked to be reminded";
    icon = "Clock";
  } else if (reasons.includes("comment")) {
    summary = `${name}${notification.parentCommentId ? " replied" : " commented"}${body ? `: ${body}` : ""}`;
    icon = "MessageSquare";
  } else if (reasons.includes("update")) {
    summary = `${name} posted an update`;
    icon = "FileText";
  } else if (reasons.includes("request")) {
    summary = body || "New customer request";
    icon = "MessageSquare";
  } else if (reasons.includes("duedatenear")) {
    summary = "Issue is due soon"; icon = "CalendarDays";
  } else if (reasons.includes("duedateoverdue")) {
    summary = "Issue is overdue"; icon = "CalendarDays";
  } else if (reasons.includes("slabreached")) {
    summary = "Issue breached its SLA";
    icon = "Timer";
  } else if (reasons.includes("slawarning")) {
    summary = "Issue is approaching its SLA";
    icon = "Timer";
  } else if (reasons.includes("status")) {
    summary = `${name} updated the issue`;
    icon = "Circle";
  }
  if(reasons.includes('duedate')&&issue){const status=data.statuses.find(s=>s.id===issue.statusId)?.type;if(issue.completedAt||['completed','canceled','duplicate'].includes(status||''))summary=status==='canceled'?'Issue was canceled':status==='duplicate'?'Issue was marked duplicate':'Issue was completed';}
  return {
    issue, project, actor, icon, summary,
    title: (destination.kind==='issue'?issue?.title:destination.kind==='document'?document?.title:destination.kind==='project'?project?.name:destination.kind==='initiative'?initiative?.name:undefined)||notification.title||"Workspace update",
    status: data.statuses.find(status => status.id === issue?.statusId),
    entityIcon: destination.kind==='document' ? "FileText" : destination.kind==='project' ? project?.icon || "Box" : destination.kind==='initiative' ? initiative?.icon || "Layers" : "Bell",
  };
}
