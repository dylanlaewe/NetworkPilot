# NetworkPilot

NetworkPilot is a private dashboard and provider-independent domain foundation for thoughtful professional-networking outreach. This milestone is deliberately limited to simulation: it does not source real contacts, call AI services, connect accounts, or send email.

## Setup

Requires Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the local development server
- `npm run build` — create a production build
- `npm start` — serve the production build
- `npm test` — run the Vitest suite once
- `npm run test:watch` — run Vitest in watch mode
- `npm run typecheck` — run strict TypeScript validation
- `npm run lint` — run ESLint with zero warnings allowed

## Current capabilities

- Responsive private-dashboard landing page with visible simulation status
- Pure daily prospect-selection engine, separated from the React UI
- Random daily target from 15–20 on weekdays only
- Relevance-first candidate ordering
- One person per company per run and a configurable seven-day company cooldown
- Filtering for prior outreach, suppression, opt-out, verified email, and minimum experience
- Injected time and randomness for deterministic tests
- Provider-independent types for prospects, companies, industries, outreach history, configuration, and results

## Simulation limitations

Contact sourcing, profile research, message drafting, scheduling, email delivery, inbox access, and reply processing are disconnected. There are no integrations with LinkedIn, CareerShift, Apollo, Gmail, Microsoft, AI APIs, or any other live provider. No email can be sent by this codebase.

The selection engine accepts in-memory data supplied by its caller. Any sample data used in future local demonstrations must remain fictional.

See [docs/architecture.md](docs/architecture.md) for the planned component boundaries.
