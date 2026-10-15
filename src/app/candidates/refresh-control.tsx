"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  humanScopedDiscoveryReadiness,
  type ScopedDiscoveryReadiness,
} from "@/application/candidate-refresh/scoped-readiness";
import { refreshCandidates } from "./actions";
import transactionStyles from "@/app/transactional-surface.module.css";
import { closeDetailsOnEscape } from "@/app/use-transactional-surface";

const labels = {
  recruiters: "Recruiters",
  peers: "Peers & practitioners",
  managers: "Managers & team leaders",
  executives: "Executives",
  ceos: "CEOs & presidents",
} as const;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={transactionStyles.primary}
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Finding people…" : `Find ${label}`}
    </button>
  );
}

export function CandidateRefreshControl({
  available,
  totalReserve = available,
  exposure = 0,
  maximumPerBatch = 5,
  maximumPerDay = 10,
  fiveBucketEnabled = false,
  bucket,
  earlyCareerOnly = false,
  legacyView = false,
  requestId,
  readiness,
  open = false,
}: {
  available: number;
  totalReserve?: number;
  exposure?: number;
  maximumPerBatch?: number;
  maximumPerDay?: number;
  fiveBucketEnabled?: boolean;
  bucket?: keyof typeof labels;
  earlyCareerOnly?: boolean;
  legacyView?: boolean;
  requestId?: string;
  readiness?: ScopedDiscoveryReadiness;
  open?: boolean;
}) {
  const [preset, setPreset] = useState<"5" | "10" | "custom">("5");
  const [custom, setCustom] = useState(5);
  const [expanded, setExpanded] = useState(open);
  const triggerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setExpanded(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const focusFrame = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled)',
        )
        ?.focus();
    });
    const onPointerDown = (event: PointerEvent) => {
      const root = panelRef.current?.closest("details");
      if (root && event.target instanceof Node && !root.contains(event.target))
        close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, expanded]);
  const desired = preset === "custom" ? custom : Number(preset);
  const remaining = Math.max(0, maximumPerDay - exposure);
  const maximumAuthorized = Math.max(
    0,
    Math.min(desired, maximumPerBatch, remaining),
  );
  const label = fiveBucketEnabled && bucket ? labels[bucket] : "people";

  if (legacyView)
    return (
      <p className="budget-message" role="status">
        Choose a recipient group before finding people. Legacy records stay
        unchanged.
      </p>
    );
  if (fiveBucketEnabled && !bucket)
    return (
      <p className="budget-message" role="status">
        Choose a recipient group first. Apollo usage is shared across all
        groups.
      </p>
    );
  if (remaining === 0)
    return (
      <p className="budget-message" role="status">
        NetworkPilot&apos;s local daily allowance is fully accounted or held.
        <small>
          This is separate from the Apollo account balance. Draft creation
          remains available, and limits can be reviewed in Settings.
        </small>
      </p>
    );
  if (fiveBucketEnabled && readiness && !readiness.ready)
    return (
      <div className="budget-message" role="status">
        <strong>Find people is unavailable</strong>
        <small>{humanScopedDiscoveryReadiness(readiness)}</small>
      </div>
    );

  return (
    <details
      className={`refresh-candidates ${transactionStyles.surface}`}
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      onKeyDown={(event) => {
        closeDetailsOnEscape(event);
        if (event.key === "Escape") close();
      }}
    >
      <summary ref={triggerRef}>Find people</summary>
      <div ref={panelRef} className={transactionStyles.menu}>
        <header className={transactionStyles.heading}>
          <h3>Find {label}</h3>
          <p>Choose a useful target, then confirm the maximum provider exposure.</p>
        </header>
        <div
          className="sourcing-target"
          role="group"
          aria-label="Desired candidate quantity"
        >
          <span className={transactionStyles.label}>Desired candidates</span>
          {(["5", "10", "custom"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={preset === value}
              onClick={() => setPreset(value)}
            >
              {value === "custom" ? "Custom" : value}
            </button>
          ))}
          {preset === "custom" ? (
            <label>
              <span>Custom quantity, 1–20</span>
              <input
                className={transactionStyles.field}
                type="number"
                min="1"
                max="20"
                step="1"
                value={custom}
                onChange={(event) =>
                  setCustom(
                    Math.max(
                      1,
                      Math.min(20, Number(event.target.value) || 1),
                    ),
                  )
                }
              />
            </label>
          ) : null}
        </div>
        <dl>
          <div><dt>Recipient group</dt><dd>{label}</dd></div>
          <div><dt>Desired candidates</dt><dd>{desired}</dd></div>
          <div><dt>Maximum credits this run</dt><dd>{maximumAuthorized}</dd></div>
          <div><dt>Remaining daily allowance</dt><dd>{remaining}</dd></div>
          <div><dt>People in this group</dt><dd>{totalReserve}</dd></div>
          <div><dt>Ready for drafts</dt><dd>{available}</dd></div>
        </dl>
        <p className={transactionStyles.helper}>
          {earlyCareerOnly ? "Scope: Early-career peers only. " : ""}
          The requested quantity is a target, not a guaranteed yield. This
          scoped search may use Apollo, up to the displayed maximum. Existing
          people are deduplicated before enrichment.
        </p>
        <form action={refreshCandidates} className={transactionStyles.actions}>
          <input type="hidden" name="confirmation" value="confirmed" />
          <input type="hidden" name="allowProvider" value="yes" />
          <input type="hidden" name="requested" value={desired} />
          {bucket ? <input type="hidden" name="bucket" value={bucket} /> : null}
          {earlyCareerOnly ? <input type="hidden" name="earlyCareerOnly" value="true" /> : null}
          {requestId ? <input type="hidden" name="requestId" value={requestId} /> : null}
          <SubmitButton label={label} />
        </form>
      </div>
    </details>
  );
}
