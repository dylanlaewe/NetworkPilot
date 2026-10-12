import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/infrastructure/sqlite/daily-refresh", () => ({
  createExactCandidateDraft: mocks.create,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/domain/recipient-buckets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domain/recipient-buckets")>()),
  fiveBucketEnabled: () => true,
}));

import { createCandidateDraft } from "./actions";

afterEach(() => vi.clearAllMocks());

describe("candidate-specific Create draft action", () => {
  it("delegates one exact candidate with an idempotency key and never calls a provider", async () => {
    const network = vi.fn(() => {
      throw new Error("provider-network-prohibited");
    });
    vi.stubGlobal("fetch", network);
    const form = new FormData();
    form.set("candidateId", "candidate-one");
    form.set("requestId", "candidate-draft-ui:request-one");
    await expect(createCandidateDraft(form)).rejects.toThrow(
      "redirect:/drafts/review?candidate=candidate-one",
    );
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith({
      candidateId: "candidate-one",
      requestId: "candidate-draft-ui:request-one",
    });
    expect(mocks.revalidate.mock.calls.map(([path]) => path)).toEqual([
      "/today",
      "/drafts",
      "/candidates",
    ]);
    expect(network).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
