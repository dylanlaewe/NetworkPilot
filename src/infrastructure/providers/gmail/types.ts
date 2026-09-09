export interface GmailAccessToken {accessToken:string;expiresAt:string;grantedScopes:readonly string[];accountEmail:string|null;}
export interface GmailTokenProvider {getAccessToken():Promise<GmailAccessToken>;setAccountEmail(email:string):Promise<void>;}
export interface GmailHttpResponse {status:number;body:string;headers:Record<string,string>;}
export interface GmailHttpTransport {request(input:{method:"GET"|"POST";path:"/gmail/v1/users/me/profile"|"/gmail/v1/users/me/drafts";body?:unknown;accessToken:string;timeoutMs:number;maxResponseBytes:number}):Promise<GmailHttpResponse>;}
