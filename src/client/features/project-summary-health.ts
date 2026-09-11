import type {Row} from './shared';

type SummaryTab = 'Health' | 'Teams' | 'Leads';
type SummarySelection = {tab: SummaryTab; value: string};

export function projectSummaryValues(project: Row, tab: SummaryTab, updates: Map<string, Row>): string[] {
  if (tab === 'Health') {
    if (project.updateHealthStatus === 'notExpected') return ['No update expected'];
    if (project.updateHealthStatus === 'missing') return ['Update missing'];
    return [updates.get(project.id)?.health || 'Update missing'];
  }
  if (tab === 'Leads') return [project.leadId || ''];
  const teams = [...new Set<string>([...(project.teamIds || []), ...(project.teamId ? [project.teamId] : [])])];
  return teams.length ? teams : [''];
}

export function matchesProjectSummary(project: Row, selection: SummarySelection | null, updates: Map<string, Row>) {
  return !selection || projectSummaryValues(project, selection.tab, updates).includes(selection.value);
}
