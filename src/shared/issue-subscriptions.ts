type SubscriptionRecord = {deletedAt?:unknown;entityKind?:string;entityId?:string;issueId?:string;userId?:string};

/** Comment-thread subscriptions do not subscribe the participant to the whole issue. */
export function targetsIssue(subscription:SubscriptionRecord,issueId:string):boolean {
  return !subscription.deletedAt && (!subscription.entityKind || subscription.entityKind==='issues') &&
    (subscription.issueId===issueId || subscription.entityId===issueId);
}

export function issueSubscribedBy(issue:{id:string;subscriberIds?:string[];subscriptionUserIds?:string[]},subscriptions:SubscriptionRecord[],userId:string|undefined):boolean {
  return !!userId && (effectiveIssueSubscribers(issue).includes(userId) || subscriptions.some(s=>s.userId===userId&&targetsIssue(s,issue.id)));
}

export function effectiveIssueSubscribers(issue:{[key:string]:any;subscriberIds?:string[];subscriptionUserIds?:string[]}):string[] {
  return [...new Set([...(issue.subscriberIds??[]),...(issue.subscriptionUserIds??[])])].sort();
}

/** Evaluate automatic subscriptions before a new issue or reassignment is saved. */
export function pendingIssueSubscribers(issue:Record<string,any>,previous:Record<string,any>|undefined,creatorId:string):string[] {
  return effectiveIssueSubscribers({...issue,subscriberIds:[
    ...(issue.subscriberIds??[]),
    ...(!previous?[creatorId]:[]),
    ...(issue.assigneeId&&issue.assigneeId!==previous?.assigneeId?[issue.assigneeId]:[]),
  ]});
}
