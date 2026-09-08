# NetworkPilot

NetworkPilot is a private, local dashboard for simulating thoughtful professional-networking campaigns. It uses only deterministic, plainly fictional contacts and cannot source real people or send email.

## Requirements and setup

Node.js 22 or newer is required. The persistence driver is `better-sqlite3`, which supports Node 22 and is automatically treated as an external server package by Next.js.

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default campaign timezone is `America/New_York`.

The simulation-only Draft Studio is available at [http://localhost:3000/draft-studio](http://localhost:3000/draft-studio). Run `npm run db:migrate` and `npm run db:seed` again after upgrading so the public target-company registry, fictional evidence, and draft schema are present.

## Local database

The default SQLite file is `data/networkpilot.sqlite`. Set `NETWORKPILOT_DATABASE_PATH` to another local file when needed. Database files, SQLite journals, environment files, and build output are ignored by Git.

- `npm run db:migrate` — apply pending versioned SQL migrations
- `npm run db:seed` — idempotently insert 180 fabricated prospects and campaign settings
- `NODE_ENV=development npm run db:reset` — development-only reset and reseed of the exact configured database

The reset command refuses to run unless `NODE_ENV` is `development` or `test`, prints its resolved target, and requires that target to remain inside this project’s real `data` directory without symlink escapes. An existing database containing data must carry the exact `datasetType=fictional` marker. Migration source files are never removed.

## Simulation workflow

The dashboard action creates one atomic simulation for the campaign-local calendar date. Before creating a new run, the application layer requires the exact fictional-dataset marker and a non-empty prospect dataset; otherwise the action stays disabled and no randomness or database write occurs. Weekday runs choose and persist a target from 15–20, record a reason-coded snapshot for every evaluated prospect, and create `simulated-sent` events for selections. Repeating the action returns the existing completed run. Weekend attempts create a stored no-send result.

The engine prioritizes relevance, limits a run to one person per company, applies a configurable seven-day company cooldown, and filters prior contact, suppressions, opt-outs, unverified addresses, and insufficient experience. Only `simulated-sent` and future `actually-sent` events consume a contact; selected, drafted, cancelled, or abandoned work does not.

## Scripts

- `npm run dev` — start local development
- `npm run build` / `npm start` — build and serve production output
- `npm test` / `npm run test:watch` — run the isolated Vitest suite
- `npm run typecheck` — strict TypeScript validation
- `npm run lint` — ESLint with zero warnings allowed
- `npm run db:migrate`, `db:seed`, `db:reset` — local fictional persistence operations

## Safety boundary

There are no integrations with LinkedIn, CareerShift, Apollo, Gmail, Microsoft, AI APIs, inboxes, or any other provider. There is no scraping, browser automation, contact sourcing, external drafting, credential handling, or email delivery. The UI contains no Send action. All names and companies produced by the seed are explicitly fabricated, and all addresses use `example.com`.

See [docs/architecture.md](docs/architecture.md) and [docs/schema.md](docs/schema.md).

## Targeting and deterministic drafts

Desired early-career job roles are modeled separately from senior networking-recipient personas. Targeting combines configurable company, current-role, function, experience, industry, geography, shared-signal, and data-quality components in the explainable `targeting-v1` score. Public target-company metadata is stored separately from fictional employment data.

Drafts are generated without AI from versioned modular templates. Every biographical statement references an approved atomic Dylan fact. Optional personalization uses only verified fictional evidence and retains its evidence ID; missing or unverified evidence produces a clean fallback. Approval changes simulation review state only and cannot deliver email.
