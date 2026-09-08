import type { Industry } from "@/domain/outreach";
import { INDUSTRIES } from "@/domain/outreach";
import { TARGET_COMPANIES } from "@/domain/targeting";
import type { SqliteSimulationRepository } from "./database";

export const FICTIONAL_PROSPECT_COUNT = 180;

export function seedFictionalData(repository: SqliteSimulationRepository): void {
  repository.transaction(() => {
    const company = repository.native.prepare("INSERT OR IGNORE INTO companies(id,name,industry) VALUES(?,?,?)");
    const person = repository.native.prepare("INSERT OR IGNORE INTO prospects(id,first_name,last_name,company_id,email,email_verified,years_experience,opted_out,relevance_score,fictional) VALUES(?,?,?,?,?,?,?,?,?,1)");
    const suppress = repository.native.prepare("INSERT OR IGNORE INTO suppression_entries(prospect_id,reason,created_at_utc) VALUES(?,?,?)");
    const targetCompany = repository.native.prepare("INSERT OR IGNORE INTO target_companies(id,canonical_name,industry_id,company_tier,enabled,recognition_score,career_upside_score,technical_interest_score,geographic_relevance_json,rationale,provenance,last_reviewed_date,operator_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const evidence = repository.native.prepare("INSERT OR IGNORE INTO personalization_evidence(id,prospect_id,source_type,source_reference,reviewed_at_utc,factual_claim,verification_status) VALUES(?,?,?,?,?,?,?)");
    for (const item of TARGET_COMPANIES) targetCompany.run(item.id,item.canonicalName,item.industryId,item.tier,Number(item.enabled),item.recognitionScore,item.careerUpsideScore,item.technicalInterestScore,JSON.stringify(item.geographicRelevance),item.rationale,item.provenance,item.lastReviewedDate,item.operatorNotes);
    for (let i = 1; i <= FICTIONAL_PROSPECT_COUNT; i += 1) {
      const suffix = String(i).padStart(3, "0");
      const industry: Industry = INDUSTRIES[(i - 1) % INDUSTRIES.length];
      company.run(`fictional-company-${suffix}`, `Imaginary Venture ${suffix}`, industry);
      person.run(`fictional-person-${suffix}`, "Fictional", `Person ${suffix}`, `fictional-company-${suffix}`, `fictional.person.${suffix}@example.com`, i % 11 === 0 ? 0 : 1, 2 + (i % 15), i % 17 === 0 ? 1 : 0, 101 - ((i * 7) % 100));
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
