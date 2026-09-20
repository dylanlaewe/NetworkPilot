export const RESUME_ROLE_LANES=["data-analytics","product","software","general"] as const;
export type ResumeRoleLane=(typeof RESUME_ROLE_LANES)[number];

export interface ResumeRecord {
  id:string;
  displayLabel:string;
  originalFilename:string;
  storageKey:string;
  sizeBytes:number;
  sha256:string;
  uploadedAt:string;
  roleLane:ResumeRoleLane|null;
  active:boolean;
}

export interface ResumeAttachmentSnapshot {
  resumeId:string;
  displayLabel:string;
  filename:string;
  storageKey:string;
  sizeBytes:number;
  sha256:string;
}

export interface ResumeRepository {
  saveResume(record:ResumeRecord):void;
  listResumes():ResumeRecord[];
  findResume(id:string):ResumeRecord|null;
  updateResumeMetadata(id:string,input:{displayLabel:string;roleLane:ResumeRoleLane|null}):void;
  deactivateResume(id:string):void;
}
