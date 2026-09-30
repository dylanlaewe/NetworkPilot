# Explicit migration boundary

NetworkPilot never upgrades a database while serving a page, loading health, running a server action, or opening an operator/provider script. Runtime repositories default to no schema mutation and call `assertRuntimeSchema`, which reads the migration ledger and required table/column shape. Read-only projections additionally open SQLite with `readonly`, `fileMustExist`, and `query_only` protections.

The required runtime version is feature-aware:

- five-bucket mode off: `0020_resume_library.sql`
- five-bucket mode on: `0022_company_trust.sql`

If the required version is absent, runtime fails with `DatabaseMigrationRequiredError`. The expected error carries the exact database path, and the UI renders an explicit targeted command such as `NETWORKPILOT_DATABASE_PATH='data/apollo-operational-scale-enrichment.sqlite' npm run db:migrate`. The operator must review that target before running it. The migration command also prints its resolved target before applying anything. The System page converts the expected condition into a visible `Migration required` state; it never repairs the schema.

## Authority and call graph

The only durable schema-upgrade path is:

```text
npm run db:migrate
  -> scripts/migrate.ts
  -> applyPendingMigrations
  -> migration files + schema_migrations ledger
```

Normal request paths are:

```text
GET / System, Today, Drafts, Sent, Candidates, Resumes
  -> read-only loader / runtime repository
  -> assertRuntimeSchema (read-only ledger and schema-shape queries)
  -> application query
```

```text
server action / local operator script / bounded provider script
  -> writable repository
  -> assertRuntimeSchema (read-only ledger and schema-shape queries)
  -> authorized application write
```

`scripts/check-no-implicit-migrations.mjs` rejects imports of migration authority outside the explicit command and test-only adapter. Repository construction contains no migration-ledger or table creation. Tests use the conspicuously named `migrateTestDatabase` helper.

`npm run db:reset` now resets only after its existing path, symlink, environment, and fictional-marker controls pass. It does not rebuild schema. The explicit recovery sequence is `db:reset`, `db:migrate`, then `db:seed`.
