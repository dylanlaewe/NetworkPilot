import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  review: vi.fn(),
  revalidate: vi.fn(),
  close: vi.fn(),
  list: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/application/company-trust", () => ({
  reviewCompanyTrust: mocks.review,
}));
vi.mock("@/domain/recipient-buckets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domain/recipient-buckets")>()),
  fiveBucketEnabled: () => true,
}));
vi.mock("@/infrastructure/sqlite/manual-outreach-operator", () => ({
  resolveManualOutreachDatabaseSelection: () => ({ path: "/fixture.sqlite" }),
}));
vi.mock("@/infrastructure/sqlite/runtime", () => ({
  openRuntimeRepository: () => ({
    listImportedCandidates: mocks.list,
    close: mocks.close,
  }),
}));

import { reviewCandidateCompanyTrust } from "./actions";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("company trust server action", () => {
  it("re-reads canonical identity and delegates the versioned audited command", async () => {
    const reviewedAt = new Date();
    mocks.list.mockReturnValue([
      {
        id: "candidate-one",
        strategyCompanyMatch: { companyId: "discovered-company-one" },
        source: {
          sourceProviderId: "apollo",
          currentOrganization: {
            domain: "fixture.example",
            providerId: "org-one",
          },
        },
      },
    ]);
    const network = vi.fn(() => {
      throw new Error("network-prohibited");
    });
    vi.stubGlobal("fetch", network);
    const form = new FormData();
    form.set("candidateId", "candidate-one");
    form.set("commandId", "company-trust-ui:command-one");
    form.set("expectedVersion", "0");
    form.set("reviewedAt", reviewedAt.toISOString());
    form.set("reason", "Reviewed company website and employment evidence");
    form.set("decision", "trusted-operating");

    await reviewCandidateCompanyTrust(form);

    expect(mocks.review).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId: "discovered-company-one",
        identity: {
          employerDomain: "fixture.example",
          providerNamespace: "apollo",
          providerEmployerId: "org-one",
        },
        expectedVersion: 0,
        resultingTrustState: "trusted-operating",
        reviewerActor: "local-operator",
        at: reviewedAt,
      }),
    );
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.revalidate.mock.calls.map(([path]) => path)).toEqual([
      "/candidates",
      "/today",
      "/drafts",
      "/candidate-review",
    ]);
    expect(network).not.toHaveBeenCalled();
  });

  it("rejects a missing reason before opening the datastore", async () => {
    const form = new FormData();
    form.set("candidateId", "candidate-one");
    form.set("commandId", "company-trust-ui:command-two");
    form.set("expectedVersion", "0");
    form.set("reviewedAt", new Date().toISOString());
    form.set("decision", "disallowed-recruiting-service");
    await expect(reviewCandidateCompanyTrust(form)).rejects.toThrow(
      "company-trust-reason-required",
    );
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
