export interface QueuePosition {index:number;top:number;y:number;at:number}

// Only transient browser geometry, never draft or outreach lifecycle state.
export function readQueuePosition(raw:string|null,now:number):QueuePosition|null{
  if(!raw)return null;
  try{
    const value=JSON.parse(raw) as QueuePosition;
    return value&&Number.isInteger(value.index)&&value.index>=-1&&
      [value.top,value.y,value.at].every(Number.isFinite)&&value.y>=0&&
      now>=value.at&&now-value.at<30*60_000?value:null;
  }catch{return null;}
}
export function queueScrollTop(position:QueuePosition,currentY:number,rowTop?:number){
  return Math.max(0,rowTop===undefined?position.y:currentY+rowTop-position.top);
}
