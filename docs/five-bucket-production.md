# Five-bucket production workflow

The five-bucket workflow is an additive, default-off capability. Migration `0021_recipient_buckets.sql` adds nullable classification, audit, scope, and recruiter-resume-preference storage without classifying historical records.

## Activation

Set `NETWORKPILOT_FIVE_BUCKET_ENABLED=true` only after migration and isolated acceptance have completed. With the setting absent or `false`, legacy navigation and behavior remain active, new bucket writes/actions reject safely, and already-stored nullable bucket evidence remains intact.

Disabling the flag is the rollback boundary. It hides bucket actions and prevents new bucket externalization; it does not down-migrate, erase audits, overwrite approved or sent snapshots, or restore an older database over legitimate subsequent outreach.

## Preserved boundaries

- Historical records without a stored bucket remain explicitly legacy/unclassified.
- Current classification changes never rewrite approved or sent content.
- Add and Replace use qualified reserve only and cannot invoke a provider.
- Scoped Find More shares the configured Apollo account, batch, and daily limits. The normal runtime currently fails closed before accounting or provider work until the separately validated scoped live adapter is supplied.
- Five-bucket classification, corrections, refresh accounting, snapshots, and recruiter resume preference live only in the canonical operational database. The recruiter enrichment database is a read-only evidence source at its own `0011` contract; it does not receive migration 0021 or mutable bucket state.
- Bucket-specific provider work runs the role-aware datastore and budget preflight before authorization. A blocked readiness state removes the confirmation form and explains the problem without exposing table names or migration versions.
- Recruiter defaults select one configured active resume for future drafts only. Other buckets default to no attachment, and approvals freeze the chosen resume version.
