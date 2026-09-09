import type {GmailHttpTransport} from "./types";

const HOST="https://gmail.googleapis.com";
export class FetchGmailTransport implements GmailHttpTransport{
  constructor(private readonly fetcher:typeof fetch=fetch){}
  async request(input:Parameters<GmailHttpTransport["request"]>[0]){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),input.timeoutMs);
    try{
      const response=await this.fetcher(`${HOST}${input.path}`,{method:input.method,redirect:"error",headers:{authorization:`Bearer ${input.accessToken}`,...input.body?{"content-type":"application/json"}:{}},...input.body?{body:JSON.stringify(input.body)}:{},signal:controller.signal});
      const declared=Number(response.headers.get("content-length"));if(Number.isFinite(declared)&&declared>input.maxResponseBytes)throw new Error("gmail-response-too-large");
      const body=await response.text();if(Buffer.byteLength(body)>input.maxResponseBytes)throw new Error("gmail-response-too-large");
      return{status:response.status,body,headers:Object.fromEntries(response.headers.entries())};
    }catch(error){if(error instanceof Error&&error.name==="AbortError")throw new Error("gmail-request-timeout");throw error;}finally{clearTimeout(timer);}
  }
}
