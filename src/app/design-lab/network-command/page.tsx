import type { Metadata } from "next";
import { NetworkCommandPrototype } from "./prototype";
import type { DraftState } from "./fixtures";

export const metadata: Metadata = {
  title: "Network Command — Isolated Design Lab",
  description: "A deterministic, fictional visual prototype for NetworkPilot.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NetworkCommandDesignLabPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const view = first(query.view);
  const size = Number(first(query.size));
  const scenario = first(query.scenario);
  const selectedState = first(query.state);

  return (
    <NetworkCommandPrototype
      initial={{
        view: view === "today" || view === "candidates" ? view : "drafts",
        queueSize: size === 5 || size === 30 ? size : 15,
        scenario:
          scenario === "gmail-reconnect" || scenario === "apollo-exhausted" || scenario === "no-reserve" || scenario === "no-drafts" || scenario === "all-caught-up" || scenario === "no-candidates"
            ? scenario
            : "standard",
        selectedState:
          selectedState === "approved" || selectedState === "gmail-created" || selectedState === "uncertain"
            ? (selectedState as DraftState)
            : "needs-review",
        density: first(query.density) === "compact" ? "compact" : "comfortable",
        paletteOpen: first(query.palette) === "1",
        filterOpen: first(query.filter) === "1",
        mobileReview: first(query.review) === "1",
        sendConfirmation: first(query.confirm) === "1",
        showSuccess: first(query.success) === "1",
        forceHover: first(query.hover) === "1",
      }}
    />
  );
}
