# Five-bucket production workflow

The five-bucket workflow is an additive, default-off capability. Migration `0021_recipient_buckets.sql` adds nullable classification, audit, scope, and recruiter-resume-preference storage without classifying historical records. The audited recruiter-employer boundary in migration `0022_company_trust.sql` is now also required before five-bucket runtime activation.

## Activation

Do not set `NETWORKPILOT_FIVE_BUCKET_ENABLED=true` merely because migration and isolated acceptance have completed. Activation additionally requires validated production scoped-Apollo wiring, a separately authorized bounded live run proving real classification and downstream draft quality, and an explicit Headquarters activation decision. The October 4 staged run validated live accounting and fail-closed classification/trust behavior, but all five candidates remained rejected or review-required, so it produced no permissible draft and did not prove the live positive path or downstream message quality. That evidence gap requires an explicit Headquarters decision before activation; it does not authorize another provider call. With the setting absent or `false`, legacy navigation and behavior remain active, new bucket writes/actions reject safely, and already-stored nullable bucket evidence remains intact.

Disabling the flag is the rollback boundary. It hides bucket actions and prevents new bucket externalization; it does not down-migrate, erase audits, overwrite approved or sent snapshots, or restore an older database over legitimate subsequent outreach.

## Preserved boundaries

- Historical records without a stored bucket remain explicitly legacy/unclassified.
- Current classification changes never rewrite approved or sent content.
- Add and Replace use qualified reserve only and cannot invoke a provider.
- Scoped Find More shares the configured Apollo account, batch, and daily limits. The normal runtime resolves the dedicated scoped Apollo adapter only when its server configuration is complete; otherwise readiness reports `provider-not-configured` before accounting or provider work. Production activation and live validation remain separate decisions.
- Five-bucket classification, company trust, corrections, refresh accounting, snapshots, and recruiter resume preference live only in the canonical operational database. The recruiter enrichment database is a read-only evidence source at its own `0011` contract; it does not receive migrations `0021`/`0022` or mutable bucket/trust state.
- Bucket-specific provider work runs the role-aware datastore and budget preflight before authorization. A blocked readiness state removes the confirmation form and explains the problem without exposing table names or migration versions.
- Recruiter defaults select one configured active resume for future drafts only. Other buckets default to no attachment, and approvals freeze the chosen resume version.
