# Simulation schema

```mermaid
erDiagram
  COMPANIES ||--o{ PROSPECTS : employs
  PROSPECTS ||--o| SUPPRESSION_ENTRIES : may_have
  SIMULATION_RUNS ||--o{ QUALIFICATION_DECISIONS : snapshots
  SIMULATION_RUNS ||--|| CAMPAIGN_PLANS : plans
  CAMPAIGN_PLANS ||--o{ CAMPAIGN_PLAN_DECISIONS : evaluates
  CAMPAIGN_PLANS ||--o{ CAMPAIGN_PLAN_LIFECYCLE : transitions
  PROSPECTS ||--o{ CAMPAIGN_PLAN_DECISIONS : snapshots
  PROSPECTS ||--o{ QUALIFICATION_DECISIONS : evaluated
  SIMULATION_RUNS ||--o{ OUTREACH_EVENTS : records
  PROSPECTS ||--o{ OUTREACH_EVENTS : concerns
  COMPANIES ||--o{ OUTREACH_EVENTS : affects
  SIMULATION_RUNS ||--o{ DRAFTS : contextualizes
  PROSPECTS ||--o{ DRAFTS : receives
  PROSPECTS ||--o{ PERSONALIZATION_EVIDENCE : has
  PROSPECTS ||--o| FICTIONAL_TARGETING_PROFILES : simulated_by
  COMPANIES ||--o| FICTIONAL_COMPANY_PROFILES : simulated_by

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
  CAMPAIGN_PLANS {
    text plan_version
    text targeting_version
    text lifecycle_status
    text diversification_config_json
    text quota_relaxations_json
  }
  CAMPAIGN_PLAN_DECISIONS {
    integer selected
    integer rank_before_diversification
    text selection_reason
    text targeting_snapshot_json
  }
  OUTREACH_EVENTS {
    text event_type
    text occurred_at_utc
  }
  DRAFTS {
    text template_id
    text template_version
    text fact_ids_json
    text evidence_ids_json
    text targeting_score_version
    real targeting_score
    text status
  }
  TARGET_COMPANIES {
    text canonical_name
    text company_tier
    real recognition_score
    real career_upside_score
    text provenance
  }
  FICTIONAL_TARGETING_PROFILES {
    text professional_title
    text role_family_id
    text persona_id
    text geography_id
    real role_alignment
    real functional_relevance
    real shared_signal
    real data_quality
  }
  FICTIONAL_COMPANY_PROFILES {
    text scenario_tier
    real recognition_score
    real career_upside_score
    real technical_interest_score
    text registry_company_id
    text registry_match_method
    text registry_match_provenance
  }
```

`campaign_plan_decisions.targeting_snapshot_json` is the immutable planning record: normalization provenance, profile and strategy versions, recipient and company inputs, registry alias provenance, score/components/explanations, hard-gate result, rank, final selection state, and reason. Drafts consume selected snapshots instead of mutable profiles. The older qualification and relevance snapshot columns remain migration-compatible but are no longer written by targeting-first planning.

`campaign_settings` stores local campaign configuration, including the IANA timezone and fictional-dataset marker. `schema_migrations` records applied migration filenames. Runtime `.sqlite`, WAL, and journal files are ignored and never committed.
