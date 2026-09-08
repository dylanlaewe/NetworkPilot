# Simulation schema

```mermaid
erDiagram
  COMPANIES ||--o{ PROSPECTS : employs
  PROSPECTS ||--o| SUPPRESSION_ENTRIES : may_have
  SIMULATION_RUNS ||--o{ QUALIFICATION_DECISIONS : snapshots
  PROSPECTS ||--o{ QUALIFICATION_DECISIONS : evaluated
  SIMULATION_RUNS ||--o{ OUTREACH_EVENTS : records
  PROSPECTS ||--o{ OUTREACH_EVENTS : concerns
  COMPANIES ||--o{ OUTREACH_EVENTS : affects

  SIMULATION_RUNS {
    text campaign_date UK
    text campaign_timezone
    text started_at_utc
    text completed_at_utc
    integer target
    integer selected_count
    integer shortfall
  }
  QUALIFICATION_DECISIONS {
    text reason_code
    integer accepted
    text prospect_name_snapshot
    text company_name_snapshot
    real relevance_score_snapshot
  }
  OUTREACH_EVENTS {
    text event_type
    text occurred_at_utc
  }
```

`campaign_settings` stores local campaign configuration, including the IANA timezone and fictional-dataset marker. `schema_migrations` records applied migration filenames. Runtime `.sqlite`, WAL, and journal files are ignored and never committed.
