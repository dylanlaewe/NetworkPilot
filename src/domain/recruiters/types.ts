export const OUTREACH_TRACKS=["professional","recruiter"] as const;
export type OutreachTrack=typeof OUTREACH_TRACKS[number];
export const RECRUITER_CLASSIFICATION_VERSION="recruiter-classification-v1" as const;
export const RECRUITER_RELEVANCE_VERSION="recruiter-relevance-v1" as const;
export type RecruiterType="technical-recruiter"|"talent-acquisition-partner"|"early-career-recruiter"|"general-recruiter"|"recruiting-manager"|"ambiguous";
export type RecruitingDomain="technical-data-ai"|"early-career"|"general"|"unknown";
export interface RecruiterClassification {track:OutreachTrack;recruiterType:RecruiterType;recruitingDomain:RecruitingDomain;internalStatus:"internal"|"agency"|"ambiguous";seniority:"recruiter"|"senior-recruiter"|"manager"|"coordinator"|"executive"|"unknown";technicalRelevance:boolean;earlyCareerRelevance:boolean;accepted:boolean;score:number;explanationCodes:string[];classificationVersion:typeof RECRUITER_CLASSIFICATION_VERSION;relevanceVersion:typeof RECRUITER_RELEVANCE_VERSION;}
export interface RecruiterDraft {track:"recruiter";subject:string;body:string;variant:"direct-introduction"|"early-career-alignment"|"technical-recruiting-alignment"|"general-internal-recruiter";wordCount:number;referencedEvidence:string[];catalogVersion:"recruiter-catalog-v3-dylan-outreach-method-v2";subjectVersion:"recruiter-subject-v3";}
