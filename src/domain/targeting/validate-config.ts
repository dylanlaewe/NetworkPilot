import type { ContactPersona, IndustryPreference, RoleFamily, TargetCompany, TargetRole } from "./types";
export function validateTargetConfiguration(config:{families:RoleFamily[];roles:TargetRole[];personas:ContactPersona[];industries:IndustryPreference[];companies:TargetCompany[]}):void{
  for(const [label,items] of [["family",config.families],["role",config.roles],["persona",config.personas],["industry",config.industries],["company",config.companies]] as const){const ids=items.map((item)=>item.id);if(new Set(ids).size!==ids.length)throw new RangeError(`Duplicate ${label} ID`);if(ids.some((id)=>!id.trim()))throw new RangeError(`Empty ${label} ID`);}
  const families=new Set(config.families.map((item)=>item.id));const industries=new Set(config.industries.map((item)=>item.id));
  if(config.roles.some((item)=>!families.has(item.familyId)))throw new RangeError("Role references unknown family");
  if(config.companies.some((item)=>!industries.has(item.industryId)))throw new RangeError("Company references unknown industry");
  if(config.personas.some((item)=>item.minimumYearsExperience<0||item.maximumYearsExperience<item.minimumYearsExperience))throw new RangeError("Invalid persona experience range");
  if(config.companies.some((item)=>[item.recognitionScore,item.careerUpsideScore,item.technicalInterestScore].some((score)=>score<0||score>100)))throw new RangeError("Company scores must be between 0 and 100");
}
