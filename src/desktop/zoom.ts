// Browser-scale presets used by the reference desktop app; zoom-level steps do
// not produce exactly these percentages and can subtly change text geometry.
const factors=[.25,1/3,.5,2/3,.75,.8,.9,1,1.1,1.25,1.5,1.75,2,2.5,3,4,5];
export function nextZoomFactor(current:number,direction:1|-1):number{
  const snapped=factors.findIndex(value=>Math.abs(value-current)<=.015);
  if(snapped>=0)return factors[Math.max(0,Math.min(factors.length-1,snapped+direction))];
  return direction===1?(factors.find(value=>value>current+.015)??factors.at(-1)!):([...factors].reverse().find(value=>value<current-.015)??factors[0]);
}
