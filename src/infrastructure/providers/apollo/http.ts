import type { ApolloHttpResponse, ApolloHttpTransport } from "./types";

const APOLLO_ORIGIN="https://api.apollo.io";
type FetchLike=(input:string,init:RequestInit)=>Promise<Response>;

async function readBoundedBody(response:Response,maximum:number):Promise<string>{
  const declared=Number(response.headers.get("content-length")??0);
  if(declared>maximum)throw new Error("apollo-response-too-large");
  if(!response.body)return"";
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;if(value){total+=value.byteLength;if(total>maximum){await reader.cancel();throw new Error("apollo-response-too-large");}chunks.push(value);}}
  const combined=new Uint8Array(total);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(combined);
}

export class FetchApolloTransport implements ApolloHttpTransport{
  constructor(private readonly fetcher:FetchLike=fetch){}
  async request(input:Parameters<ApolloHttpTransport["request"]>[0]):Promise<ApolloHttpResponse>{
    const url=new URL(input.path,APOLLO_ORIGIN);
    if(url.protocol!=="https:"||url.hostname!=="api.apollo.io"||url.origin!==APOLLO_ORIGIN)throw new Error("apollo-url-rejected");
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),input.timeoutMs);
    try{const response=await this.fetcher(url.toString(),{method:"POST",redirect:"error",signal:controller.signal,headers:{"Content-Type":"application/json","Cache-Control":"no-store","x-api-key":input.apiKey},body:JSON.stringify(input.body)});return{status:response.status,headers:{"retry-after":response.headers.get("retry-after")??undefined},body:await readBoundedBody(response,input.maxResponseBytes)};}catch(error){if(error instanceof Error&&error.name==="AbortError")throw new Error("apollo-request-timeout");throw error;}finally{clearTimeout(timer);}
  }
}
