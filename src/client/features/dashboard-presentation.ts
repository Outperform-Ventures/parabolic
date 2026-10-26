import type {InsightConfig} from './insight-data';

export type DashboardDisplay = 'chart' | 'table' | 'metric';
/** Old widgets used chartType for both calculation and presentation. Do not rewrite saved data. */
export function dashboardDisplay(widget: Record<string, any>): DashboardDisplay {
  if (['chart','table','metric'].includes(widget.displayMode)) return widget.displayMode;
  return widget.chartType === 'Metric' ? 'metric' : widget.chartType === 'Table' ? 'table' : 'chart';
}
export function dashboardConfig(config: InsightConfig, mode: DashboardDisplay): InsightConfig {
  return {...config, chartType: mode === 'metric' ? 'Metric' : mode === 'table' ? 'Table' :
    ['Metric','Table'].includes(config.chartType) ? 'Auto' : config.chartType};
}
export function dashboardFilterCount(filter: any): number {
  return (filter?.conditions?.length || 0) + (filter?.groups || []).reduce((sum:number, group:any) => sum + dashboardFilterCount(group), 0);
}
