import type { Industry } from "@/domain/outreach";
import { INDUSTRIES } from "@/domain/outreach";
import type { SqliteSimulationRepository } from "./database";

export const FICTIONAL_PROSPECT_COUNT = 180;

export function seedFictionalData(repository: SqliteSimulationRepository): void {
  repository.transaction(() => {
    const company = repository.native.prepare("INSERT OR IGNORE INTO companies(id,name,industry) VALUES(?,?,?)");
    const person = repository.native.prepare("INSERT OR IGNORE INTO prospects(id,first_name,last_name,company_id,email,email_verified,years_experience,opted_out,relevance_score,fictional) VALUES(?,?,?,?,?,?,?,?,?,1)");
    const suppress = repository.native.prepare("INSERT OR IGNORE INTO suppression_entries(prospect_id,reason,created_at_utc) VALUES(?,?,?)");
    for (let i = 1; i <= FICTIONAL_PROSPECT_COUNT; i += 1) {
      const suffix = String(i).padStart(3, "0");
      const industry: Industry = INDUSTRIES[(i - 1) % INDUSTRIES.length];
      company.run(`fictional-company-${suffix}`, `Imaginary Venture ${suffix}`, industry);
      person.run(`fictional-person-${suffix}`, "Fictional", `Person ${suffix}`, `fictional-company-${suffix}`, `fictional.person.${suffix}@example.com`, i % 11 === 0 ? 0 : 1, 2 + (i % 15), i % 17 === 0 ? 1 : 0, 101 - ((i * 7) % 100));
      if (i % 19 === 0) suppress.run(`fictional-person-${suffix}`, "Fictional suppression seed", "2026-01-01T00:00:00.000Z");
    }
    repository.setSetting("campaignTimezone", "America/New_York", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("datasetType", "fictional", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("companyCooldownDays", "7", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("minimumYearsExperience", "5", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("minimumDailyTarget", "15", new Date("2026-01-01T00:00:00.000Z"));
    repository.setSetting("maximumDailyTarget", "20", new Date("2026-01-01T00:00:00.000Z"));
  });
}
