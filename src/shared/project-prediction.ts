export type ProjectPrediction = {
  type: 'notStarted' | 'completed' | 'tooEarly' | 'stale' | 'prediction';
  date?: number; optimistic?: number; pessimistic?: number; weeklyVelocity?: number;
};

export function projectProgressVelocity(history: number[], progress: number): number {
  if (!history.length) return progress;
  if (history.length === 1) return Math.round(Math.max(history[0], progress - history[0]));
  const deltas = history.map((value, index) => value - (history[index - 1] ?? 0));
  const currentDelta = progress - history.at(-1)!;
  if (currentDelta >= deltas.at(-1)!) deltas.push(currentDelta);
  let sum = 0, weightSum = 0;
  for (let index = 0; index < deltas.length; index++) {
    const weight = Math.max(0, index - history.length + 6);
    sum += deltas[index] * weight;
    weightSum += weight;
  }
  return Math.max(0, Math.round(sum / weightSum));
}

export function projectCompletionPrediction(input: {
  started: boolean; completed: boolean; hasIssueHistory: boolean; issueCount: number;
  completedHistory: number[]; scope: number; progress: number; now: number;
}): ProjectPrediction {
  if (!input.started) return { type: 'notStarted' };
  if (input.completed) return { type: 'completed' };
  if (!input.hasIssueHistory || !input.issueCount) return { type: 'tooEarly' };
  const velocity = projectProgressVelocity(input.completedHistory, input.progress);
  const history = input.completedHistory;
  if (!velocity || (history.length >= 3 && history.at(-1)! <= history.at(-3)! && input.progress <= history.at(-1)!)) return { type: 'stale' };
  const remaining = input.scope - input.progress;
  if (remaining <= 0) return { type: 'completed' };
  const weeklyVelocity = Math.max(2, velocity);
  const offsetDays = (timestamp: number, days: number) => {
    const value = new Date(timestamp);
    value.setDate(value.getDate() + days);
    return value.getTime();
  };
  const date = offsetDays(input.now, 7 * remaining / weeklyVelocity);
  const calendarDay = (timestamp: number) => {
    const value = new Date(timestamp);
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86_400_000;
  };
  const days = calendarDay(date) - calendarDay(input.now);
  return { type: 'prediction', weeklyVelocity, date, optimistic: offsetDays(date, -days / 2.5), pessimistic: offsetDays(date, days / 2.5) };
}
