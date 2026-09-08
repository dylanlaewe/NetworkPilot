"use client";

import { useActionState } from "react";
import type { SimulationActionState } from "./actions";

const initialState: SimulationActionState = { error: null };

export function SimulationUnavailableControl() {
  return <div className="simulation-control unavailable" role="status">
    <button className="simulate-button" type="button" disabled aria-disabled="true">Run today’s fictional simulation</button>
    <span>Fictional simulation data is unavailable. Run <code>npm run db:seed</code> first.</span>
  </div>;
}

export function ReadySimulationControl({ action, existing }: { action: (state: SimulationActionState) => Promise<SimulationActionState>; existing: boolean }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="simulation-control">
    <button className="simulate-button" type="submit" disabled={pending}>{pending ? "Running simulation…" : "Run today’s fictional simulation"}</button>
    <span>{state.error ?? (existing ? "Running again returns today’s stored result." : "Creates one atomic, auditable local run.")}</span>
  </form>;
}
