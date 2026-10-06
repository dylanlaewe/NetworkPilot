import { describe, expect, it, vi } from "vitest";
import {
  MigrationTargetConfigurationError,
  resolveExplicitMigrationTarget,
} from "./migration-target";

describe("explicit migration target", () => {
  it("requires NETWORKPILOT_DATABASE_PATH instead of using the system default", () => {
    expect(() =>
      resolveExplicitMigrationTarget(
        {
          NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH:
            "data/apollo-operational-scale-enrichment.sqlite",
        },
        "/workspace",
        () => true,
      ),
    ).toThrowError(MigrationTargetConfigurationError);
  });

  it("returns the resolved absolute target only when the file exists", () => {
    const targetExists = vi.fn(() => true);
    expect(
      resolveExplicitMigrationTarget(
        { NETWORKPILOT_DATABASE_PATH: "data/operational.sqlite" },
        "/workspace",
        targetExists,
      ),
    ).toBe("/workspace/data/operational.sqlite");
    expect(targetExists).toHaveBeenCalledWith(
      "/workspace/data/operational.sqlite",
    );
  });

  it("rejects a missing target rather than creating a new database", () => {
    expect(() =>
      resolveExplicitMigrationTarget(
        { NETWORKPILOT_DATABASE_PATH: "/missing/operational.sqlite" },
        "/workspace",
        () => false,
      ),
    ).toThrow("Migration target does not exist: /missing/operational.sqlite");
  });

  it("rejects conflicting migration and canonical target configuration", () => {
    expect(() =>
      resolveExplicitMigrationTarget(
        {
          NETWORKPILOT_DATABASE_PATH: "data/networkpilot.sqlite",
          NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH:
            "data/apollo-operational-scale-enrichment.sqlite",
        },
        "/workspace",
        () => true,
      ),
    ).toThrow("refusing an ambiguous migration target");
  });

  it("accepts matching explicit migration and canonical targets", () => {
    expect(
      resolveExplicitMigrationTarget(
        {
          NETWORKPILOT_DATABASE_PATH: "data/operational.sqlite",
          NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH:
            "/workspace/data/operational.sqlite",
        },
        "/workspace",
        () => true,
      ),
    ).toBe("/workspace/data/operational.sqlite");
  });
});
