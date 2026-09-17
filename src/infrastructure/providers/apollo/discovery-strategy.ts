import type {ApolloSearchOptions} from "./types";
export const BROAD_DISCOVERY_MAX_SEARCH_CALLS=4;
export const BROAD_DISCOVERY_TITLES=["Data Engineer","Analytics Engineer","Software Engineer","Data Analytics Manager","Technical Recruiter","University Recruiter"] as const;
export function broadCompanyDiscoveryQueries():ApolloSearchOptions[]{return [
  {batchId:"broad-company-discovery-professional",specificTitles:[...BROAD_DISCOVERY_TITLES.slice(0,3)],includeSimilarTitles:false,personLocations:["United States"],perPage:25,page:1},
  {batchId:"broad-company-discovery-recruiter",specificTitles:[...BROAD_DISCOVERY_TITLES.slice(3)],includeSimilarTitles:false,personLocations:["United States"],perPage:25,page:1},
];}
