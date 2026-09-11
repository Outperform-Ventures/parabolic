/** Age thresholds from the public client model, independent of reminder dispatch. */
export function updateAging(ageDays:number, frequency:'daily'|'weekly', interval:number) {
 const period = frequency === 'weekly' ? interval * 7 : interval;
 return {slightlyOutdated: interval > 0 && ageDays >= period + 1,
   outdated: interval > 0 && ageDays >= period + (frequency === 'weekly' ? 3 : 1)};
}
