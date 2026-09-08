import type { Industry } from "@/domain/outreach";
import { INDUSTRIES } from "@/domain/outreach";
import { TARGET_COMPANIES } from "@/domain/targeting";
import type { SqliteSimulationRepository } from "./database";

export const FICTIONAL_PROSPECT_COUNT = 180;

export function seedFictionalData(repository: SqliteSimulationRepository): void {
  repository.transaction(() => {
    const company = repository.native.prepare("INSERT INTO companies(id,name,industry) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,industry=excluded.industry");
    const person = repository.native.prepare("INSERT INTO prospects(id,first_name,last_name,company_id,email,email_verified,years_experience,opted_out,relevance_score,fictional) VALUES(?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,company_id=excluded.company_id,email=excluded.email,email_verified=excluded.email_verified,years_experience=excluded.years_experience,opted_out=excluded.opted_out,relevance_score=excluded.relevance_score,fictional=1");
    const suppress = repository.native.prepare("INSERT OR IGNORE INTO suppression_entries(prospect_id,reason,created_at_utc) VALUES(?,?,?)");
    const targetCompany = repository.native.prepare("INSERT OR IGNORE INTO target_companies(id,canonical_name,industry_id,company_tier,enabled,recognition_score,career_upside_score,technical_interest_score,geographic_relevance_json,rationale,provenance,last_reviewed_date,operator_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const evidence = repository.native.prepare("INSERT OR IGNORE INTO personalization_evidence(id,prospect_id,source_type,source_reference,reviewed_at_utc,factual_claim,verification_status) VALUES(?,?,?,?,?,?,?)");
    const companyProfile=repository.native.prepare("INSERT INTO fictional_company_profiles(company_id,industry_id,scenario_tier,recognition_score,career_upside_score,technical_interest_score,profile_version,registry_company_id,registry_match_method,registry_match_provenance) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET industry_id=excluded.industry_id,scenario_tier=excluded.scenario_tier,recognition_score=excluded.recognition_score,career_upside_score=excluded.career_upside_score,technical_interest_score=excluded.technical_interest_score,profile_version=excluded.profile_version,registry_company_id=excluded.registry_company_id,registry_match_method=excluded.registry_match_method,registry_match_provenance=excluded.registry_match_provenance");
    const targetingProfile=repository.native.prepare("INSERT INTO fictional_targeting_profiles(prospect_id,professional_title,role_family_id,desired_role_id,persona_id,geography_id,industry_id,role_alignment,functional_relevance,shared_signal,data_quality,role_specific_upside,profile_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(prospect_id) DO UPDATE SET professional_title=excluded.professional_title,role_family_id=excluded.role_family_id,desired_role_id=excluded.desired_role_id,persona_id=excluded.persona_id,geography_id=excluded.geography_id,industry_id=excluded.industry_id,role_alignment=excluded.role_alignment,functional_relevance=excluded.functional_relevance,shared_signal=excluded.shared_signal,data_quality=excluded.data_quality,role_specific_upside=excluded.role_specific_upside,profile_version=excluded.profile_version");
    for (const item of TARGET_COMPANIES) targetCompany.run(item.id,item.canonicalName,item.industryId,item.tier,Number(item.enabled),item.recognitionScore,item.careerUpsideScore,item.technicalInterestScore,JSON.stringify(item.geographicRelevance),item.rationale,item.provenance,item.lastReviewedDate,item.operatorNotes);
    for (let i = 1; i <= FICTIONAL_PROSPECT_COUNT; i += 1) {
      const suffix = String(i).padStart(3, "0");
      const specialIndustries:Industry[]=["Defense","Finance","Technology","Commodities","Technology","Consulting","Defense","Finance","Technology","Commodities"];
      const industry: Industry = specialIndustries[i-1]??INDUSTRIES[(i - 1) % INDUSTRIES.length];
      const familyIds=["data-analytics","technical-product","business-delivery","industry-professional"];
      const familyId=["data-analytics","data-analytics","business-delivery","industry-professional","technical-product","data-analytics","data-analytics","data-analytics","technical-product","industry-professional"][i-1]??familyIds[(i*7)%familyIds.length];
      const desiredRoleId=familyId==="data-analytics"?"data-1":familyId==="technical-product"?"technical-1":familyId==="business-delivery"?"delivery-1":"industry-1";
      const titles=["Senior Data Engineer","Analytics Manager","Technical Program Leader","Commodities Analyst","Unrelated Corporate Executive","Junior Data Peer","Principal Analytics Engineer","Business Intelligence Analyst","Senior Automation Engineer","Market Data Analyst"];
      const title=titles[i-1]??["Data Integration Engineer","Solutions Engineer","Program Analyst","Operations Analyst","Senior Data Practitioner"][i%5];
      const specialYears=[12,14,13,8,25,1,12,7,11,9];
      const yearsExperience=specialYears[i-1]??(5+(i%16));
      const personas=["senior-ic","team-manager","project-leader","experienced-practitioner","select-vp","experienced-practitioner","senior-ic","experienced-practitioner","senior-ic","experienced-practitioner"];
      const seededPersonaId=personas[i-1]??["experienced-practitioner","senior-ic","team-manager","project-leader"][i%4];
      const personaId=yearsExperience<8?"experienced-practitioner":seededPersonaId;
      const geographyIds=["new-jersey","nyc","boston-ma","remote-us","broader-us","boston-ma","broader-us","nyc","new-jersey","remote-us"];
      const geographyId=geographyIds[i-1]??["boston-ma","nyc","new-jersey","remote-us","broader-us"][(i*3)%5];
      const roleAlignment=[96,90,88,94,10,42,98,68,91,82][i-1]??(55+(i*13)%46);
      const functionalRelevance=[98,92,90,96,5,35,99,70,94,84][i-1]??(50+(i*17)%51);
      const sharedSignal=[70,55,62,58,10,30,66,48,95,52][i-1]??((i*19)%101);
      const dataQuality=[100,95,92,90,80,88,100,94,98,45][i-1]??(65+(i*11)%36);
      company.run(`fictional-company-${suffix}`, `Imaginary Venture ${suffix}`, industry);
      person.run(`fictional-person-${suffix}`, "Fictional", `Person ${suffix}`, `fictional-company-${suffix}`, `fictional.person.${suffix}@example.com`, i % 11 === 0 ? 0 : 1, yearsExperience, i % 17 === 0 ? 1 : 0, 101 - ((i * 7) % 100));
      const scenarioTier=i%9===0?"tier-1":i%7===0?"tier-3":"tier-2";
      const industryId=industry==="Consulting"?"consulting":industry==="Finance"?"financial-services":industry==="Commodities"?"commodities-energy":industry==="Defense"?"defense-aerospace":"technology-ai";
      const registryOptions=TARGET_COMPANIES.filter((item)=>item.industryId===industryId&&item.enabled);
      const registryCompany=registryOptions[(i-1)%registryOptions.length];
      companyProfile.run(`fictional-company-${suffix}`,industryId,scenarioTier,55+(i*5)%41,60+(i*7)%41,50+(i*11)%51,"fictional-company-profile-v1",registryCompany?.id??null,"simulation-alias","Explicit fictional scenario alias; no real-company employment claim.");
      targetingProfile.run(`fictional-person-${suffix}`,title,familyId,desiredRoleId,personaId,geographyId,industryId,roleAlignment,functionalRelevance,sharedSignal,dataQuality,scenarioTier==="tier-3"?90:80+(i%21),"fictional-targeting-profile-v1");
      if (i % 19 === 0) suppress.run(`fictional-person-${suffix}`, "Fictional suppression seed", "2026-01-01T00:00:00.000Z");
      if (i % 3 === 0) evidence.run(`fictional-evidence-${suffix}`,`fictional-person-${suffix}`,"fictional-simulation",`fictional://prospect/${suffix}`,"2026-09-07T12:00:00.000Z","their fictional team is improving a multi-system analytics workflow",i%2===0?"verified":"unverified");
    }
    repository.setSetting("campaignTimezone", "America/New_York", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("datasetType", "fictional", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("companyCooldownDays", "7", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("minimumYearsExperience", "5", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("minimumDailyTarget", "15", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("maximumDailyTarget", "20", new Date("2026-01-01T00:00:00.000Z"));
  });
}
