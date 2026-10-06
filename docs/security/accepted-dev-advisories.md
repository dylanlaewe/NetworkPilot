# Accepted development-only advisories

This file records narrowly bounded, temporary exceptions for vulnerabilities that
are absent from the production dependency tree and are not reachable through the
NetworkPilot production runtime. It does not change npm severity data or make the
raw full `npm audit` pass.

## 2026-10-06 production advisory remediation

Two newly disclosed production advisories were remediated before controlled activation: `GHSA-wq5f-xc86-pv6w` by updating `sharp` from 0.35.4 to 0.35.5, and `GHSA-68fv-2mgg-jv7q` by updating `source-map-js` from 1.2.1 to 1.2.2. Both were compatible patch updates inside existing transitive ranges; `package.json` and application behavior were unchanged. The resolved production tree contains the patched versions, `npm audit --omit=dev` reports zero vulnerabilities, and an independent security review found no unrelated dependency churn or runtime-compatibility blocker. This remediation does not alter the separately bounded development-only exception below.

## GHSA-vfj7-8cjw-p6xm / CVE-2026-93687

| Field | Reviewed value |
| --- | --- |
| Status | Temporarily accepted for development tooling only |
| Severity | High |
| Affected package | `braces@3.0.3` (`<=3.0.3` is affected) |
| Weakness | Stack-exhaustion denial of service through deeply nested brace patterns (CWE-674) |
| Reviewed | 2026-10-04 |
| Mandatory re-review | 2026-11-03 (the security gate fails on this date) |
| Upstream patch status | No patched version; `3.0.3` is the latest registry release |

### Exact dependency path

```text
root devDependency
└─ eslint-config-next@16.3.4
   └─ @next/eslint-plugin-next@16.3.4
      └─ fast-glob@3.3.1
         └─ micromatch@4.0.8
            └─ braces@3.0.3
```

All five package-lock entries in this path are marked `dev: true`.
`npm ls --omit=dev braces micromatch fast-glob eslint-config-next
@next/eslint-plugin-next --all` returns an empty tree, and `npm audit --omit=dev`
reports zero vulnerabilities.

The full raw npm audit reports five high-severity package findings. They are the
propagated effects of this one advisory: `braces` affects `micromatch`, which
affects `fast-glob`, which affects `@next/eslint-plugin-next`, which affects the
direct development dependency `eslint-config-next`.

### Reachability assessment

`npm run lint` loads `eslint-config-next` and `@next/eslint-plugin-next`. In the
plugin, `fast-glob` is required by `dist/utils/get-root-dirs.js`; its `globSync`
function is called only when repository ESLint settings provide
`settings.next.rootDir` as a string or array. The current `eslint.config.mjs`
does not define `settings.next.rootDir`, so the current lint configuration does
not send a glob pattern through this chain.

If `settings.next.rootDir` is added later, the brace/glob input would come from
that repository-controlled ESLint configuration. The `eslint .` file argument
is not the input to this plugin call. No pattern in this dependency path comes
from arbitrary user input, network requests, candidate or provider data, Apollo
responses, Gmail data, or environment variables.

The dependency is absent from the production dependency tree and production
bundle. Normal Next.js production requests do not load ESLint or this plugin.
Accordingly, this advisory is **not reachable through the NetworkPilot
production runtime**. This is a scoped reachability conclusion, not a claim that
the upstream vulnerability is unexploitable in every environment.

### Upstream and remediation assessment

Registry metadata reviewed on 2026-10-04 reported `braces@3.0.3` as the latest
published version. The GitHub advisory reported `<=3.0.3` as affected and no
patched version. The security command rechecks the latest published version on
every run. npm's proposed automatic remediation is a breaking downgrade to
`eslint-config-next@14.2.35`, which is not an acceptable alignment for Next 16.
No forced audit fix, forked replacement, dependency override, or downgrade is
approved.

Remediate and remove this exception when any of these occurs:

- a patched `braces` release becomes available;
- `eslint-config-next` removes the dependency path;
- a compatible Next.js toolchain update removes the advisory;
- the mandatory 30-day re-review date arrives; or
- any change makes the relevant glob patterns user-, network-, provider-,
  candidate-, Gmail-, Apollo-, or environment-controlled.

### Enforcement

Run the repository's standard security validation command:

```bash
npm run check:security-audit
```

The gate runs both production-only and full npm audits. It passes only when the
production audit is empty and the full audit contains exactly this advisory
through the exact reviewed, dev-only package versions and dependency edges. A
new advisory, changed path, production vulnerability, loss of a `dev: true`
marker, changed npm remediation, newly published `braces` version, change to
the reviewed ESLint configuration, or expiration fails the gate. The reviewed
remediation is specifically the breaking downgrade to
`eslint-config-next@14.2.35`; a newly offered compatible remediation therefore
forces review. Pinning the exact reviewed `eslint.config.mjs` digest ensures any
configuration change forces a fresh reachability review before the exception
can continue. The expected current result is:

```text
PASS WITH APPROVED DEV-ONLY EXCEPTION: GHSA-vfj7-8cjw-p6xm
```

The raw full `npm audit` remains nonzero with five high-severity package
findings; it must not be described as zero vulnerabilities.
