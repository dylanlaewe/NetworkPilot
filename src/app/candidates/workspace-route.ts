import type { BucketSelection } from "@/app/recipient-bucket-navigation";

export function candidateWorkspaceRouteKey(
  selection: BucketSelection,
  earlyCareerOnly: boolean,
  findMoreOpen: boolean,
) {
  return `${selection}:${earlyCareerOnly ? "early-career" : "all-career"}:${findMoreOpen ? "find-more" : "browse"}`;
}
