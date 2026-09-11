/** SLA outcomes use a strict deadline; equality is a breach. */
export function classifySla(issue: Record<string, any>, now = Date.now()) {
  if (!issue.slaDueAt || issue.canceledAt || issue.slaCanceled) return null;
  const due = Date.parse(issue.slaDueAt);
  if (issue.completedAt) return Date.parse(issue.completedAt) < due ? 'achieved' : 'failed';
  if (now >= due) return 'breached';
  const high = issue.slaHighRiskAt ? Date.parse(issue.slaHighRiskAt) : due - 86400000;
  const medium = issue.slaMediumRiskAt ? Date.parse(issue.slaMediumRiskAt) : due - 7 * 86400000;
  return now >= high ? 'highRisk' : now >= medium ? 'mediumRisk' : 'lowRisk';
}
