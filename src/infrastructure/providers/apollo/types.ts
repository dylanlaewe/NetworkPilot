import type { CandidateSourceRecord } from "@/domain/candidates";
export const APOLLO_ADAPTER_VERSION="apollo-adapter-v1" as const;
export const APOLLO_MAPPING_VERSION="apollo-mapping-v1" as const;
export const APOLLO_IMPORT_VERSION="provider-import-v1" as const;
export type ApolloSeniority="manager"|"director"|"senior";
export interface ApolloSearchOptions {batchId:string;companyDomains?:string[];organizationIds?:string[];specificTitles?:string[];seniorities?:ApolloSeniority[];personLocations?:string[];organizationLocations?:string[];emailStatuses?:string[];includeSimilarTitles?:boolean;controlledDiagnosticAuthorization?:"milestone-6.1b"|"milestone-6.3";page?:number;perPage?:number;}
export interface ApolloEnrichmentOptions {batchId:string;personIds:string[];persistedSearchPersonIds?:string[];creditCostPolicy?:"disabled-phone-v1";}
export interface ApolloConfig {enabled:boolean;apiKey?:string;maxEnrichmentsPerBatch:number;maxEnrichmentsPerDay:number;hardStop:boolean;timeoutMs:number;maxResponseBytes:number;maxRetries:number;}
export interface ApolloHttpResponse {status:number;headers:Readonly<Record<string,string|undefined>>;body:string;}
export interface ApolloHttpTransport {request(input:{path:"/api/v1/mixed_people/api_search"|"/api/v1/people/match"|"/api/v1/usage_stats/credit_usage_stats";body:unknown;apiKey:string;timeoutMs:number;maxResponseBytes:number}):Promise<ApolloHttpResponse>;}
export interface ApolloSearchResult {records:CandidateSourceRecord[];totalAvailable:number|null;requestVersion:string;}
export interface ApolloCreditUsage {cycleStart:string|null;cycleEnd:string|null;leadCreditsLimit:number|null;leadCreditsConsumed:number|null;leadCreditsRemaining:number|null;observedAt:string;adapterVersion:typeof APOLLO_ADAPTER_VERSION;}
export interface ApolloBudgetAuthorization {operationId:string;estimatedMaxExposure:number;remainingDaily:number;}
export interface ApolloBudgetRepository {authorizeApolloOperation(input:{operationId:string;batchId:string;localDate:string;candidateCount:number;estimatedMaxExposure:number;maximumPerBatch:number;maximumPerDay:number;hardStop:boolean;at:Date}):ApolloBudgetAuthorization;recordApolloAttempt(operationId:string):void;completeApolloOperation(operationId:string,observedConsumption:number|null):void;failApolloOperation(operationId:string,reason:string):void;}
