"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateSourcingLimits,
  type SourcingLimitsActionState,
} from "./actions";

const initialState: SourcingLimitsActionState = {
  status: "idle",
  message: "",
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save limits"}
    </button>
  );
}

export function SourcingLimitsForm({
  dailyAllowance,
  maximumPerRun,
}: {
  dailyAllowance: number;
  maximumPerRun: number;
}) {
  const [state, action] = useActionState(updateSourcingLimits, initialState);
  return (
    <form action={action} className="sourcing-limits-form">
      <label>
        <span>Daily NetworkPilot credit allowance</span>
        <input name="dailyAllowance" type="number" min="1" max="1000" step="1" defaultValue={dailyAllowance} required />
      </label>
      <label>
        <span>Maximum credits per Find people run</span>
        <input name="maximumPerRun" type="number" min="1" max="20" step="1" defaultValue={maximumPerRun} required />
      </label>
      <SaveButton />
      {state.status !== "idle" ? (
        <p className="sourcing-limits-result" data-status={state.status} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
