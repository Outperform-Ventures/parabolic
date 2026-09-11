import {searchTokens,searchStemWords,matchesStemmedSearchWords,searchCanonical,searchStatusRank} from './search-language';
import {filterConditionCount} from '../shared/filter-groups';
import { matchesFilter } from "./query";
import type { Entity } from "../shared/types";
let labels: Entity[] = [];
let projects: Entity[] = [];
let cycles: Entity[] = [];
let milestones: Entity[] = [];
let issues: Entity[] = [];
let currentUserId: string | undefined;
const plain = (value: any) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
let records: (Entity & {
    kind: string;
    searchText: string;
    searchTitle: string;
    commentText: string;
  })[] = [],
  statuses = new Map<string, string>();
self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  if (message.type === "index") {
    labels = message.labels ?? [];
    projects = message.projects ?? [];
    cycles = message.cycles ?? [];
    milestones = message.milestones ?? [];
    currentUserId = message.currentUserId;
    issues = message.records.filter((e:Entity)=>e.kind==='issues'&&!e.deletedAt);
    const comments = new Map<string, string>();
    for (const comment of message.comments ?? []) {
      const id =
        comment.issueId ??
        (comment.entityType === "issue" ? comment.entityId : undefined);
      if (id && !comment.deletedAt)
        comments.set(id, `${comments.get(id) ?? ""} ${plain(comment.body)}`);
    }
    statuses = new Map(
      (message.statuses ?? []).map((s: any) => [s.id, s.type]),
    );
    records = message.records
      .filter((e: Entity) => !e.deletedAt)
      .map((entity: Entity & { kind: string }) => ({
        ...entity,
        searchTitle:
          `${entity.identifier ?? ""} ${entity.title ?? entity.name ?? ""}`.toLowerCase(),
        commentText: comments.get(entity.id) ?? "",
        searchText:
          searchStemWords(`${entity.identifier ?? ""} ${(entity.identifier ?? "").replaceAll("-", "")} ${(entity.previousIdentifiers??[]).flatMap((id:string)=>[id,id.replaceAll('-','')]).join(' ')} ${entity.title ?? entity.name ?? ""} ${plain(entity.description ?? entity.content)} ${comments.get(entity.id) ?? ""}`),
      }));
    self.postMessage({ type: "indexed" });
    return;
  }
  if (message.type !== "search") return;
  const tokens=searchTokens(String(message.query));
  const hasTerms = tokens.length > 0 || filterConditionCount(message.filter) > 0;
  const matches = records.filter(
    (record) =>
      hasTerms &&
      message.kinds.includes(record.kind) &&
      (message.includeArchived || !record.archivedAt) &&
      matchesFilter(record, message.filter, labels, projects, cycles,undefined,currentUserId,issues,milestones) &&
      matchesStemmedSearchWords(record.searchText,tokens),
  );
  const rank=(entity:Entity)=>searchStatusRank(entity.archivedAt,entity.kind,statuses.get(entity.statusId));
  const normalized=searchCanonical(String(message.query));
  const exact=(entity:Entity)=>searchCanonical(String(entity.identifier??''))===normalized?0:searchCanonical(String(entity.title??entity.name??''))===normalized?1:2;
  matches.sort((a, b) =>
    message.orderBy === "updatedAt"
      ? b.updatedAt.localeCompare(a.updatedAt)
      : message.orderBy === "createdAt"
        ? b.createdAt.localeCompare(a.createdAt)
        : exact(a)-exact(b)||rank(a) - rank(b) ||
          Number(b.searchTitle.includes(message.query.toLowerCase())) -
            Number(a.searchTitle.includes(message.query.toLowerCase())) ||
          b.updatedAt.localeCompare(a.updatedAt),
  );
  self.postMessage({
    type: "results",
    id: message.id,
    nodes: matches
      .slice(0, 500)
      .map(({ searchText, searchTitle, commentText, ...entity }) => {
        const token = tokens.find((token) =>
          commentText.toLowerCase().includes(token.value),
        );
        const index = token
          ? commentText.toLowerCase().indexOf(token.value)
          : -1;
        return index >= 0
          ? {
              ...entity,
              matchSnippet: commentText.slice(
                Math.max(0, index - 55),
                index + 180,
              ),
            }
          : entity;
      }),
    totalCount: matches.length,
  });
};
