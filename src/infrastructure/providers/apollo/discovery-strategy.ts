import type {ApolloSearchOptions} from "./types";
export const BROAD_DISCOVERY_MAX_SEARCH_CALLS=4;
export const BROAD_DISCOVERY_TITLES={
  analytics:["Data Analyst","Business Intelligence Analyst","Analytics Engineer","Business Analyst","Operations Analyst","Financial Analyst","Investment Analyst","Strategy Analyst","Consulting Analyst","Project Analyst","Program Analyst"],
  product:["Product Manager","Associate Product Manager","Technical Product Manager","Product Analyst","Product Operations","Product Operations Analyst","Technical Product Analyst","Data Product Manager","AI Product Manager","Platform Product Manager"],
  technical:["Data Engineer","Data Scientist","Software Engineer","Machine Learning Engineer","AI Engineer","Technical Program Manager"],
  adjacent:["Reporting Analyst","Insights Analyst","Decision Scientist","Revenue Operations Analyst","Business Operations Analyst","Implementation Analyst","Solutions Analyst","Systems Analyst","Research Analyst","Risk Analyst","Portfolio Analyst","Data Governance Analyst","Data Quality Analyst"],
  recruiters:["Technical Recruiter","Engineering Recruiter","Data Recruiter","University Recruiter","Campus Recruiter","Early Career Recruiter","Talent Acquisition Partner"],
} as const;
const northeastAndNational=["Boston, Massachusetts","New York, New York","New Jersey","Remote, United States","United States"];
export function broadCompanyDiscoveryQueries():ApolloSearchOptions[]{return [
  {batchId:"broad-company-discovery-analytics-product",specificTitles:[...BROAD_DISCOVERY_TITLES.analytics,...BROAD_DISCOVERY_TITLES.product],includeSimilarTitles:false,personLocations:northeastAndNational,perPage:25,page:1},
  {batchId:"broad-company-discovery-technical",specificTitles:[...BROAD_DISCOVERY_TITLES.technical],includeSimilarTitles:false,personLocations:northeastAndNational,perPage:25,page:2},
  {batchId:"broad-company-discovery-adjacent",specificTitles:[...BROAD_DISCOVERY_TITLES.adjacent],includeSimilarTitles:false,personLocations:northeastAndNational,perPage:25,page:3},
  {batchId:"broad-company-discovery-recruiters",specificTitles:[...BROAD_DISCOVERY_TITLES.recruiters],includeSimilarTitles:false,personLocations:["United States"],perPage:25,page:2},
];}
