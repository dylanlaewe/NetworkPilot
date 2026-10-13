import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readApolloConfig } from "@/infrastructure/providers/apollo/config";
import { migrateTestDatabase } from "./test-migrations";
import { SqliteSimulationRepository } from "./database";
import { loadSourcingUsage, persistSourcingLimits } from "./sourcing-limits";
import { runCandidateRefresh } from "./candidate-refresh";
import type { ScopedDiscoveryProvider } from "@/application/candidate-refresh/scoped";

const directories: string[] = [];
afterEach(() => {
  directories
    .splice(0)
    .forEach((directory) => rmSync(directory, { recursive: true, force: true }));
  vi.unstubAllEnvs();
});

function repository() {
  const directory = mkdtempSync(join(tmpdir(), "networkpilot-limits-"));
  directories.push(directory);
  const result = new SqliteSimulationRepository(join(directory, "test.sqlite"));
  migrateTestDatabase(result);
  result.setSetting(
    "campaignTimezone",
    "America/New_York",
    new Date("2026-10-13T12:00:00Z"),
  );
  return result;
}

const config = readApolloConfig({
  NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_BATCH: "5",
  NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_DAY: "10",
});

describe("persisted sourcing limits", () => {
  it("starts from configured defaults and survives a repository restart", () => {
    const first = repository();
    const path = first.native.name;
    expect(loadSourcingUsage(first, config, new Date("2026-10-13T16:00:00Z"))).toMatchObject({
      dailyAllowance: 10,
      maximumPerRun: 5,
      remainingAllowance: 10,
      localDate: "2026-10-13",
      timezone: "America/New_York",
      nextResetLabel: "Oct 14, 2026 at 12:00 AM (America/New_York)",
    });
    persistSourcingLimits(first, { dailyAllowance: 18, maximumPerRun: 7 });
    first.close();
    const reopened = new SqliteSimulationRepository(path, { fileMustExist: true });
    expect(loadSourcingUsage(reopened, config)).toMatchObject({
      dailyAllowance: 18,
      maximumPerRun: 7,
    });
    reopened.close();
  });

  it("raises only future headroom and lowering below exposure blocks new spend", () => {
    const subject = repository();
    const at = new Date("2026-10-13T16:00:00Z");
    subject.authorizeApolloOperation({
      operationId: "held",
      batchId: "held",
      localDate: "2026-10-13",
      candidateCount: 4,
      estimatedMaxExposure: 4,
      maximumPerBatch: 5,
      maximumPerDay: 10,
      hardStop: true,
      at,
    });
    persistSourcingLimits(subject, { dailyAllowance: 12, maximumPerRun: 5 }, at);
    expect(loadSourcingUsage(subject, config, at)).toMatchObject({
      accountedOrHeldExposure: 4,
      remainingAllowance: 8,
    });
    persistSourcingLimits(subject, { dailyAllowance: 2, maximumPerRun: 2 }, at);
    expect(loadSourcingUsage(subject, config, at)).toMatchObject({
      accountedOrHeldExposure: 4,
      remainingAllowance: 0,
    });
    subject.close();
  });

  it("rejects unlimited, non-integer, and per-run-over-daily settings", () => {
    const subject = repository();
    expect(() => persistSourcingLimits(subject, { dailyAllowance: Infinity, maximumPerRun: 5 })).toThrow("sourcing-daily-allowance-invalid");
    expect(() => persistSourcingLimits(subject, { dailyAllowance: 10, maximumPerRun: 2.5 })).toThrow("sourcing-maximum-per-run-invalid");
    expect(() => persistSourcingLimits(subject, { dailyAllowance: 4, maximumPerRun: 5 })).toThrow("sourcing-maximum-exceeds-daily-allowance");
    subject.close();
  });

  it("applies saved limits in the real scoped sourcing authorization path", async () => {
    const subject = repository();
    const path = subject.native.name;
    persistSourcingLimits(subject, { dailyAllowance: 7, maximumPerRun: 2 });
    subject.close();
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true");
    vi.stubEnv("NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH", path);
    const discover = vi.fn<ScopedDiscoveryProvider["discover"]>(async () => ({
      records: [],
      searchedCandidates: 0,
      rejectedCandidates: 0,
      enrichmentAttempts: 0,
      searchCalls: 0,
      observedCredits: 0,
    }));
    const result = await runCandidateRefresh({
      allowProvider: true,
      now: () => new Date("2026-10-13T16:00:00Z"),
      scope: { bucket: "managers" },
      requestId: "saved-limits-real-path",
      requested: 10,
      scopedProvider: { preflight: vi.fn(), discover },
    });
    expect(discover).toHaveBeenCalledWith(
      expect.objectContaining({ maximum: 2, scope: { bucket: "managers" } }),
    );
    expect(result).toMatchObject({ providerCap: 2, maximumProviderUsage: 2 });
  });
});
