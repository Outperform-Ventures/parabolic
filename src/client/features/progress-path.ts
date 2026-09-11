export type ProgressPlotPoint={x:number,y:number};

/**
 * Retain the last cumulative value in each visual x bucket. Project history
 * intentionally contains pre/post-transition pairs a millisecond apart; at
 * chart scale those pairs occupy the same pixel and recreate a staircase even
 * when connected by cubic curves.
 */
export function coalesceProjectProgressPoints(points:ProgressPlotPoint[],minimumDistance=8){
  if(points.length<2)return [...points];
  const ordered=[...points].sort((left,right)=>left.x-right.x),result:ProgressPlotPoint[]=[];
  let bucketStart=ordered[0].x,pending=ordered[0];
  for(const point of ordered.slice(1)){
    if(point.x-bucketStart<minimumDistance){pending=point;continue}
    result.push(pending);bucketStart=point.x;pending=point;
  }
  result.push(pending);
  return result;
}
