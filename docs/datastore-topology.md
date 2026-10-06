# NetworkPilot datastore topology

NetworkPilot uses multiple SQLite files because controlled provider validation was developed in isolated stages. Their migration numbers are intentionally heterogeneous. A filename or the presence of an application table does not make a database authoritative; the role and capability contract below does.

| Store | Path / configuration | Role and authority | Expected schema | Access and users | Durable application migrations |
| --- | --- | --- | --- | --- | --- |
| Canonical operational | `NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH`, default `data/apollo-operational-scale-enrichment.sqlite` | Sole source of truth for imported candidates promoted into the product, company trust/audit, recipient-bucket state/evidence/corrections, refresh/accounting operations, drafts, Gmail operations, outreach, suppression, and recruiter resume preference | Current application schema; `0022_company_trust.sql` when five-bucket mode is enabled | Read/write through `SqliteSimulationRepository`, command-center loaders, scoped discovery, Gmail/manual-outreach repositories | Yes, only through explicit `npm run db:migrate` against the reviewed target |
| Application/system | `NETWORKPILOT_DATABASE_PATH`, default `data/networkpilot.sqlite` | Private simulation/system state. It is not the canonical real-outreach or five-bucket store | `0020_resume_library.sql` while five-bucket mode is off; feature-aware only if deliberately selected as canonical | Simulation runtime, dashboard/system diagnostics, seed/reset commands | Yes when deliberately operated as the application target; never implicitly |
| Recruiter enrichment source | `NETWORKPILOT_RECRUITER_DATABASE_PATH`, default `data/apollo-recruiter-enrichment.sqlite` | Read-only secondary evidence from the controlled recruiter discovery milestone. It is not authoritative for bucket state, trust, corrections, refresh operations, drafts, outreach, or defaults | `0011_outreach_tracks.sql` | Legacy candidate projection and recruiter evidence reads | No. Do not add canonical migrations `0021`/`0022` merely to satisfy canonical logic |
| Professional search cache | `data/apollo-operational-scale-search.sqlite` | Scratch/cache of provider search normalization used as replenishment input | Its own validated lineage, currently through `0010_manual_hard_bounce.sql` | `ApolloDailyReplenisher` reads `imported_candidates`; controlled provider scripts wrote the original cache | No routine application migration; recreate only through an explicitly authorized workflow |
| Recruiter search cache | `data/apollo-recruiter-search.sqlite` | Scratch/cache of recruiter search normalization | Its own validated lineage, currently through `0011_outreach_tracks.sql` | `ApolloDailyReplenisher` and controlled recruiter scripts | No routine application migration |
| Gmail persistence | No separate store | Gmail connection metadata, immutable approved snapshots, draft/send operations, audits, and manual fallback records live in the canonical operational store | Canonical schema | Gmail draft/send adapters and manual operators | Follows canonical migrations |
| Simulation, tests, and QA | Injected temporary path or `:memory:` | Test-only/scratch. Never production authority | Test-selected lineage | Vitest helpers and isolated validation scripts | Test-only explicit migration helper |

## Ownership rules

Five-bucket mutable state exists exactly once, in the canonical operational store. Source stores contribute immutable provider evidence through stable provider IDs or deliberately imported projections. They do not receive recipient-bucket corrections, bucket refresh operations, outreach snapshots, or recruiter resume preferences.

The runtime capability model distinguishes `canonical-operational`, `application-system`, `source-evidence`, `scratch-cache`, and `test-only`. Capabilities such as bucket-state writes and provider accounting are declared independently from candidate-evidence reads. Asking a source descriptor for a canonical capability fails before authorization or provider work.

Schema presence does not assign a role. In particular, the accepted additive 0021/0022 schema drift on `data/networkpilot.sqlite` does not give that application/system datastore canonical ownership, bucket-write authority, provider-accounting authority, or company-trust authority.

## Scoped sourcing preflight

The production order is:

1. validate feature, bucket, request, and bounds;
2. validate canonical role, capabilities, schema, and all local completion projections;
3. validate the recruiter evidence source against its own `0011` contract when recruiter sourcing is requested;
4. validate canonical budget plus external validation spend;
5. validate the injected provider adapter locally;
6. atomically reserve the idempotent canonical operation;
7. call search/enrichment;
8. normalize, classify, and persist only in the canonical store;
9. finalize truthful accounting.

No runtime preflight migrates a database. Ordinary UI renders a human readiness message and omits the confirmation form when blocked. Technical details remain available to diagnostics and tests.

## September 27 external validation spend

The aborted isolated five-bucket validation moved Apollo account usage from 220 to 240. It produced no completed imports, but the 20 credits are real. `external-spend.ts` records that account-level safety hold for the September 27 New York provider window. The shared Apollo authorization and status ledger applies that hold to both scoped and legacy refresh paths, so neither can silently reuse the credits even though the isolated ledger was not production authority. It does not fabricate candidate success or retroactively import records. A future authorized validation must start in a fresh daily window and still perform the account-usage baseline check defined by its validated adapter.
