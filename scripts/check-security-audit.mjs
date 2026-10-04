import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const APPROVED_EXCEPTION = Object.freeze({
  advisory: "GHSA-vfj7-8cjw-p6xm",
  cve: "CVE-2026-93687",
  package: "braces",
  version: "3.0.3",
  reviewedOn: "2026-10-04",
  expiresOn: "2026-11-03",
  path: Object.freeze([
    Object.freeze({
      lockKey: "node_modules/eslint-config-next",
      name: "eslint-config-next",
      version: "16.3.4",
      dependency: "@next/eslint-plugin-next",
      requirement: "16.3.4",
    }),
    Object.freeze({
      lockKey: "node_modules/@next/eslint-plugin-next",
      name: "@next/eslint-plugin-next",
      version: "16.3.4",
      dependency: "fast-glob",
      requirement: "3.3.1",
    }),
    Object.freeze({
      lockKey: "node_modules/fast-glob",
      name: "fast-glob",
      version: "3.3.1",
      dependency: "micromatch",
      requirement: "^4.0.4",
    }),
    Object.freeze({
      lockKey: "node_modules/micromatch",
      name: "micromatch",
      version: "4.0.8",
      dependency: "braces",
      requirement: "^3.0.3",
    }),
    Object.freeze({
      lockKey: "node_modules/braces",
      name: "braces",
      version: "3.0.3",
    }),
  ]),
});

const EXPECTED_VULNERABILITIES = Object.freeze({
  "eslint-config-next": {
    via: ["@next/eslint-plugin-next"],
    effects: [],
  },
  "@next/eslint-plugin-next": {
    via: ["fast-glob"],
    effects: ["eslint-config-next"],
  },
  "fast-glob": { via: ["micromatch"], effects: ["@next/eslint-plugin-next"] },
  micromatch: { via: ["braces"], effects: ["fast-glob"] },
  braces: { via: [APPROVED_EXCEPTION.advisory], effects: ["micromatch"] },
});

function sorted(values) {
  return [...values].sort();
}

function sameStrings(actual, expected) {
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
}

function viaIdentifiers(via) {
  return via.map((item) => {
    if (typeof item === "string") return item;
    const match = item?.url?.match(/GHSA-[a-z0-9-]+/i);
    return match?.[0] ?? `unrecognized-advisory:${item?.source ?? "unknown"}`;
  });
}

function validateProductionAudit(productionAudit) {
  const vulnerabilities = productionAudit?.vulnerabilities ?? {};
  const total = productionAudit?.metadata?.vulnerabilities?.total;
  if (Object.keys(vulnerabilities).length !== 0 || total !== 0) {
    throw new Error("production audit contains a vulnerability");
  }
}

function validateFullAudit(fullAudit) {
  const vulnerabilities = fullAudit?.vulnerabilities ?? {};
  const actualNames = Object.keys(vulnerabilities);
  const expectedNames = Object.keys(EXPECTED_VULNERABILITIES);

  if (!sameStrings(actualNames, expectedNames)) {
    throw new Error(
      `full audit findings changed (expected ${expectedNames.join(", ")}; received ${actualNames.join(", ") || "none"})`,
    );
  }

  for (const [name, expected] of Object.entries(EXPECTED_VULNERABILITIES)) {
    const actual = vulnerabilities[name];
    if (actual?.severity !== "high") {
      throw new Error(`${name} severity changed from the reviewed high-severity finding`);
    }
    if (!sameStrings(viaIdentifiers(actual.via ?? []), expected.via)) {
      throw new Error(`${name} advisory/dependency cause changed`);
    }
    if (!sameStrings(actual.effects ?? [], expected.effects)) {
      throw new Error(`${name} dependent-package effects changed`);
    }
  }

  const bracesFinding = vulnerabilities.braces;
  const advisory = bracesFinding.via.find((item) => typeof item === "object");
  if (
    advisory?.name !== APPROVED_EXCEPTION.package ||
    advisory?.dependency !== APPROVED_EXCEPTION.package ||
    advisory?.range !== "<=3.0.3"
  ) {
    throw new Error("braces advisory identity or affected range changed");
  }
}

function validateLockfilePath(lockfile) {
  const packages = lockfile?.packages ?? {};
  const rootRequirement = packages[""]?.devDependencies?.[APPROVED_EXCEPTION.path[0].name];
  if (rootRequirement !== APPROVED_EXCEPTION.path[0].version) {
    throw new Error("approved dependency path no longer starts at the reviewed root devDependency");
  }

  for (const segment of APPROVED_EXCEPTION.path) {
    const entry = packages[segment.lockKey];
    if (!entry || entry.version !== segment.version || entry.dev !== true) {
      throw new Error(`${segment.name} is missing, changed version, or is no longer dev-only`);
    }
    if (
      segment.dependency &&
      entry.dependencies?.[segment.dependency] !== segment.requirement
    ) {
      throw new Error(`${segment.name} no longer has the exact reviewed dependency edge`);
    }
  }
}

function validateReviewWindow(today) {
  if (today >= APPROVED_EXCEPTION.expiresOn) {
    throw new Error(
      `approved exception expired on ${APPROVED_EXCEPTION.expiresOn}; re-review is required`,
    );
  }
}

export function evaluateSecurityAudit({ productionAudit, fullAudit, lockfile, today }) {
  validateProductionAudit(productionAudit);
  validateFullAudit(fullAudit);
  validateLockfilePath(lockfile);
  validateReviewWindow(today);
  return `PASS WITH APPROVED DEV-ONLY EXCEPTION: ${APPROVED_EXCEPTION.advisory}`;
}

function runNpmAudit(args) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["audit", ...args, "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!result.stdout) {
    throw new Error(`npm audit did not return JSON: ${result.stderr.trim()}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm audit returned invalid JSON: ${result.stderr.trim()}`);
  }
}

function main() {
  try {
    const productionAudit = runNpmAudit(["--omit=dev"]);
    const fullAudit = runNpmAudit([]);
    const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const today = new Date().toISOString().slice(0, 10);
    console.log(evaluateSecurityAudit({ productionAudit, fullAudit, lockfile, today }));
  } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
