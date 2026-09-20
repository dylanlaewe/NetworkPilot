import {describe,expect,it} from "vitest";
import {queueScrollTop,readQueuePosition} from "./queue-position";

describe("transient queue reading position",()=>{
  const position={index:10,top:250,y:600,at:1000};
  it("restores a recent position without storing outreach identities",()=>{
    expect(readQueuePosition(JSON.stringify(position),2000)).toEqual(position);
    expect(Object.keys(position)).toEqual(["index","top","y","at"]);
  });
  it.each([null,"broken","null",JSON.stringify({...position,index:0.5}),JSON.stringify({...position,y:-1}),JSON.stringify({...position,top:null}),JSON.stringify({...position,at:3000})])("ignores malformed or future browser state: %s",raw=>{
    expect(readQueuePosition(raw,2000)).toBeNull();
  });
  it("expires old navigation state",()=>expect(readQueuePosition(JSON.stringify(position),1801000)).toBeNull());
  it("keeps the next row in the same viewport position after removal",()=>expect(queueScrollTop(position,0,850)).toBe(600));
  it("uses the prior scroll for non-row actions or an empty queue",()=>expect(queueScrollTop(position,0)).toBe(600));
  it("clamps above-page targets",()=>expect(queueScrollTop(position,0,100)).toBe(0));
});
