import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  APPROVED_EXCEPTION,
  evaluateSecurityAudit,
} from "./check-security-audit.mjs";

const reviewedEslintConfigSource = readFileSync(
  new URL("../eslint.config.mjs", import.meta.url),
  "utf8",
);

function reviewedProductionAudit() {
  return {
    vulnerabilities: {},
    metadata: { vulnerabilities: { total: 0 } },
  };
}

function reviewedFullAudit() {
  return {
    vulnerabilities: {
      "eslint-config-next": {
        severity: "high",
        via: ["@next/eslint-plugin-next"],
        effects: [],
      },
      "@next/eslint-plugin-next": {
        severity: "high",
        via: ["fast-glob"],
        effects: ["eslint-config-next"],
      },
      "fast-glob": {
        severity: "high",
        via: ["micromatch"],
        effects: ["@next/eslint-plugin-next"],
      },
      micromatch: {
        severity: "high",
        via: ["braces"],
        effects: ["fast-glob"],
      },
      braces: {
        severity: "high",
        via: [
          {
            name: "braces",
            dependency: "braces",
            range: "<=3.0.3",
            url: `https://github.com/advisories/${APPROVED_EXCEPTION.advisory}`,
          },
        ],
        effects: ["micromatch"],
      },
    },
  };
}

function reviewedLockfile() {
  const packages = {
    "": {
      devDependencies: {
        "eslint-config-next": "16.3.4",
      },
    },
  };

  for (const segment of APPROVED_EXCEPTION.path) {
    packages[segment.lockKey] = {
      version: segment.version,
      dev: true,
      dependencies: segment.dependency
        ? { [segment.dependency]: segment.requirement }
        : undefined,
    };
  }

  return { packages };
}

function reviewedInput() {
  return {
    productionAudit: reviewedProductionAudit(),
    fullAudit: reviewedFullAudit(),
    lockfile: reviewedLockfile(),
    latestPublishedVersion: APPROVED_EXCEPTION.latestPublishedVersion,
    eslintConfigSource: reviewedEslintConfigSource,
    today: "2026-10-04",
  };
}

test("recognizes only the exact reviewed dev-only advisory", () => {
  assert.equal(
    evaluateSecurityAudit(reviewedInput()),
    `PASS WITH APPROVED DEV-ONLY EXCEPTION: ${APPROVED_EXCEPTION.advisory}`,
  );
});

test("fails for an unrelated dev advisory", () => {
  const input = reviewedInput();
  input.fullAudit.vulnerabilities.unrelated = {
    severity: "moderate",
    via: [],
    effects: [],
  };
  assert.throws(() => evaluateSecurityAudit(input), /full audit findings changed/);
});

test("fails for any production vulnerability", () => {
  const input = reviewedInput();
  input.productionAudit.vulnerabilities.runtime = { severity: "low" };
  input.productionAudit.metadata.vulnerabilities.total = 1;
  assert.throws(() => evaluateSecurityAudit(input), /production audit contains/);
});

test("fails when an approved dependency edge changes", () => {
  const input = reviewedInput();
  input.lockfile.packages["node_modules/fast-glob"].dependencies.micromatch = "^5.0.0";
  assert.throws(() => evaluateSecurityAudit(input), /exact reviewed dependency edge/);
});

test("fails when an approved dependency is no longer dev-only", () => {
  const input = reviewedInput();
  input.lockfile.packages["node_modules/braces"].dev = false;
  assert.throws(() => evaluateSecurityAudit(input), /no longer dev-only/);
});

test("fails when the latest published braces version changes", () => {
  const input = reviewedInput();
  input.latestPublishedVersion = "3.0.4";
  assert.throws(() => evaluateSecurityAudit(input), /registry version changed/);
});

test("fails when the reviewed ESLint reachability premise can change", () => {
  const input = reviewedInput();
  input.eslintConfigSource += "\n// configuration changed\n";
  assert.throws(() => evaluateSecurityAudit(input), /re-review braces reachability/);
});

test("fails on the mandatory re-review date", () => {
  const input = reviewedInput();
  input.today = APPROVED_EXCEPTION.expiresOn;
  assert.throws(() => evaluateSecurityAudit(input), /exception expired/);
});
