import type { DraftAdditionFeedback } from "@/application/daily-refresh/addition-feedback";

export type DraftAdditionActionState = {
  status: "idle" | "success" | "partial" | "zero" | "error";
  message: string;
  reasons: string[];
  recovery: DraftAdditionFeedback["recovery"];
};

// This value must remain in a client-safe module. Values exported from a
// `use server` module become server references in client bundles.
export const initialDraftAdditionActionState: DraftAdditionActionState = {
  status: "idle",
  message: "",
  reasons: [],
  recovery: null,
};
