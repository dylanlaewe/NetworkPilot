"use client";

import { useState } from "react";
import { NetworkCommandShell } from "@/app/network-command-shell";
import { DEMO_FIXTURE, DEMO_PROFILE } from "@/demo/mode";
import styles from "./today-command.module.css";

type Stage = "generated" | "approved" | "draft-created" | "sent" | "replied";
const labels: Record<Stage, string> = { generated: "Review draft", approved: "Create mock Gmail draft", "draft-created": "Simulate send", sent: "Record sample reply", replied: "Reply recorded" };
const next: Partial<Record<Stage, Stage>> = { generated: "approved", approved: "draft-created", "draft-created": "sent", sent: "replied" };

export function DemoToday() {
  const [stage, setStage] = useState<Stage>("generated");
  const recipient = DEMO_FIXTURE.recipients[0];
  const company = DEMO_FIXTURE.companies[0];
  return <NetworkCommandShell current="today" status="Demo mode · synthetic data only">
    <div className={styles.today}>
      <section className={styles.now}>
        <header><p>Synthetic workspace for {DEMO_PROFILE.name}</p><h1>Today</h1><span>One safe, simulated next step.</span></header>
        <article className={styles.primaryTask}>
          <div><span>1</span><div><h2>{labels[stage]}</h2><p>{recipient} at {company} · No live provider, Gmail, or real contact is available in demo mode.</p></div></div>
          <button type="button" disabled={!next[stage]} onClick={() => next[stage] && setStage(next[stage]!)}>{labels[stage]}</button>
        </article>
        <section className={styles.later}><h2>After that</h2><div><span><strong>Review the simulated relationship</strong><small>The demo preserves the same explicit lifecycle without external side effects.</small></span><b>{stage}</b></div></section>
      </section>
    </div>
  </NetworkCommandShell>;
}
