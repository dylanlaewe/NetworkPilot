import { describe, expect, it } from "vitest";
import { ACTIVE_LIMIT, addDrafts, approve, capacity, correctBucket, findMore, initialState, lifecycle, queueAction, rows, unavailableReason, validation } from "./model";
import { CANONICAL, personalize, TEMPLATE_VERSION } from "./templates";

describe("approved canonical copy", () => {
  it("preserves the manager prose exactly and passes with no question mark", () => {
    expect(CANONICAL.managers).toEqual({
      subject: "A question about your career in [field]",
      body: `Hi [First name],

I'm Dylan, a recent computer science graduate from Marist University in Poughkeepsie, New York. I've been working in BI and data engineering, building automations and connecting business systems.

I saw your role at [Company] and wanted to introduce myself. I'm trying to learn as much as I can from people's experiences and success in [field], especially [specific topic].

I would love to connect about your career and how you've approached that part of your work.

Thank you in advance for your guidance,
Dylan`,
    });
    const state = initialState();
    const manager = state.people.find(p => p.id === "managers-0")!;
    expect(manager.body).not.toContain("?");
    expect(validation(manager, state.resumes)).toEqual([]);
    expect(approve(state, manager.id).people.find(p => p.id === manager.id)?.stage).toBe("approved");
  });
  it("preserves the executive prose exactly", () => {
    expect(CANONICAL.executives).toEqual({ subject: "A question about building toward leadership", body: `Hi [First name],

I'm Dylan, a recent computer science graduate from Marist University working in BI and data engineering.

Your role leading [verified function] at [Company] is the kind of responsibility I'd like to grow toward. I'm especially interested in staying close to new technology while taking on more responsibility for people and what gets built.

I'm sure you're extremely busy, but would it be possible to throw 10-15 mins on your calendar for a quick chat?

I promise I'll pay your time forward.

Best,
Dylan` });
  });
  it("preserves the CEO/president prose exactly", () => {
    expect(CANONICAL.ceos).toEqual({ subject: "Guidance for someone starting out", body: `Hi [First name],

I know this is a long shot, but [specific reason for contacting this person] made me want to ask for your guidance.

I'm a recent Marist University computer science graduate working in BI and data engineering. Eventually, I'd like to build useful products and lead a team, and I'm trying to understand what I should focus on now to get there.

I'm sure your calendar is packed, but would you be open to finding 15 minutes for a conversation?

I promise I'll pay your time forward.

Thanks,
Dylan` });
    expect(TEMPLATE_VERSION).toBe("approved-2026-09-22.v1");
  });
  it("does not invent a missing leadership function", () => {
    expect(personalize(CANONICAL.executives.body, { Company: "Fictional Works" })).toContain("[verified function]");
    const s = initialState();
    const p = { ...s.people.find(p => p.id === "executives-0")!, body: CANONICAL.executives.body };
    expect(validation(p, s.resumes)).toContain("Resolve the personalization placeholders from evidence.");
  });
});

describe("isolated five-bucket workflow", () => {
  it("uses unique fictional people, .invalid recipients, and all five buckets", () => {
    const s = initialState();
    expect(new Set(s.people.map(p => p.id)).size).toBe(s.people.length);
    expect(s.people.every(p => p.email.endsWith(".invalid"))).toBe(true);
    expect(new Set(s.people.map(p => p.bucket)).size).toBe(5);
    expect(s.resumes).toHaveLength(3);
    expect(s.people.find(p => p.id === "recruiters-0")?.bucket).toBe("recruiters");
    expect(s.people.find(p => p.id === "peers-1")?.earlyCareer).toBe(false);
  });
  it("adds five additional drafts while preserving content, IDs, attachment and order", () => {
    const s = initialState();
    s.people[0].body += "\nA deliberate edit.";
    const before = structuredClone(s);
    const next = addDrafts(s, "recruiters", 5);
    expect(next.queue.slice(0, s.queue.length)).toEqual(s.queue);
    expect(next.queue).toHaveLength(s.queue.length + 5);
    for (const id of s.queue) expect(next.people.find(p => p.id === id)).toEqual(s.people.find(p => p.id === id));
    expect(next.queue.slice(-5).every(id => next.people.find(p => p.id === id)?.attachment === "general-v2")).toBe(true);
    expect(s).toEqual(before);
    expect(new Set(next.queue).size).toBe(next.queue.length);
    expect(capacity(next, "recruiters")).toHaveLength(2);
  });
  it("rejects invalid counts, reports shortfall, and enforces shared active capacity", () => {
    const s = initialState();
    expect(addDrafts(s, "recruiters", 0).queue).toEqual(s.queue);
    expect(addDrafts(s, "recruiters", 1.5).queue).toEqual(s.queue);
    expect(addDrafts(s, "recruiters", 20).notice).toContain("Added 7 of 20");
    const full = addDrafts(s, "peers", 20);
    expect(full.queue).toHaveLength(ACTIVE_LIMIT);
    expect(addDrafts(full, "recruiters", 5).queue).toHaveLength(ACTIVE_LIMIT);
  });
  it("scopes early-career additions and replacement to the visible practitioner preference", () => {
    const state = initialState();
    expect(capacity(state, "peers")).toHaveLength(24);
    expect(capacity(state, "peers", true)).toHaveLength(12);
    const added = addDrafts(state, "peers", 5, true);
    const newIds = added.queue.filter(id => !state.queue.includes(id));
    expect(newIds).toHaveLength(5);
    expect(newIds.every(id => added.people.find(p => p.id === id)?.earlyCareer)).toBe(true);
    expect(added.notice).toContain("5 of 5 additional early-career peer drafts");
    const replaced = queueAction(added, "peers-0", "replace", true);
    const replacement = replaced.people.find(p => p.id === replaced.queue[state.queue.indexOf("peers-0")])!;
    expect(replacement.bucket).toBe("peers");
    expect(replacement.earlyCareer).toBe(true);
  });
  it("reports a scoped early-career shortage without silently adding experienced peers", () => {
    const state = initialState();
    capacity(state, "peers", true).slice(2).forEach(p => { p.block = "Fictional cooldown"; });
    expect(capacity(state, "peers").length).toBeGreaterThan(5);
    const added = addDrafts(state, "peers", 5, true);
    expect(added.queue.length - state.queue.length).toBe(2);
    expect(added.notice).toContain("2 of 5 additional early-career peer drafts");
    expect(added.notice).toContain("selected scope");
    expect(queueAction(added, "peers-0", "replace", true).queue).toEqual(added.queue);
    expect(queueAction(added, "peers-0", "replace", true).notice).toContain("Early-career only filter");
  });
  it("discovers early-career peers inside the active filter with the same shared allowance", () => {
    const state = initialState();
    const next = findMore(state, "peers", true);
    const added = next.people.filter(p => !state.people.some(original => original.id === p.id));
    expect(added).toHaveLength(3);
    expect(added.every(p => p.bucket === "peers" && p.earlyCareer)).toBe(true);
    expect(next.notice).toContain("3 of 5 requested early-career peers");
    expect(next.budgetUsed).toBe(5);
  });
  it("honors shared company, prior-contact, bounce and exclusion constraints", () => {
    const s = initialState();
    const recruiter = s.people.find(p => p.id === "recruiters-2")!;
    recruiter.company = s.people.find(p => p.id === "peers-0")!.company;
    expect(unavailableReason(s, recruiter)).toContain("Company contact policy");
    const next = addDrafts(s, "recruiters", 20);
    expect(next.people.find(p => p.id === recruiter.id)?.stage).toBe("reserve");
    expect(next.people.filter(p => p.block).every(p => p.stage !== "editing")).toBe(true);
    const excluded = queueAction(s, "recruiters-0", "exclude");
    expect(excluded.people[0].stage).toBe("excluded");
    expect(excluded.people[0].history).toEqual([]);
    expect(capacity(excluded, "recruiters").some(p => p.id === "recruiters-0")).toBe(false);
  });
  it("skip avoids contact and replacement retains queue position in the same bucket", () => {
    const s = initialState();
    const skipped = queueAction(s, "recruiters-0", "skip");
    expect(skipped.people[0].history).toEqual([]);
    expect(skipped.people[0].block).toBeUndefined();
    expect(capacity(skipped, "recruiters").some(p => p.id === "recruiters-0")).toBe(false);
    const replaced = queueAction(s, "recruiters-1", "replace");
    expect(replaced.queue[1]).toBe("recruiters-2");
    expect(replaced.queue.length).toBe(s.queue.length);
    const exhausted = addDrafts(s, "recruiters", 20);
    expect(queueAction(exhausted, "recruiters-0", "replace").queue).toEqual(exhausted.queue);
    expect(queueAction(exhausted, "recruiters-0", "replace").notice).toContain("No eligible replacement");
  });
  it("resolves missing defaults explicitly and does not rewrite prior approvals on deactivation", () => {
    const s = initialState();
    s.defaultResume = "general-v1";
    const next = addDrafts(s, "recruiters", 1);
    const p = next.people.find(p => p.id === "recruiters-2")!;
    expect(p.attachment).toBeNull();
    expect(p.resumeDecisionNeeded).toBe(true);
    expect(validation(p, next.resumes).length).toBeGreaterThan(0);
    const approved = approve(initialState(), "recruiters-0");
    const frozen = structuredClone(approved.people[0].approved);
    approved.resumes[0].active = false;
    approved.defaultResume = "product-v1";
    expect(approved.people[0].approved).toEqual(frozen);
    expect(approved.people[0].approved?.attachment?.active).toBe(true);
  });
  it("keeps the accepted fictional Sent attachment claim and frozen evidence coherent", () => {
    const sentRecruiter = initialState().people.find(p => p.id === "recruiters-11")!;
    expect(sentRecruiter.history).toHaveLength(1);
    expect(sentRecruiter.history[0].body).toContain("I've attached my resume.");
    expect(sentRecruiter.history[0].attachment).toMatchObject({ id: "general-v2", label: "General Resume" });
  });
  it("requires explicit attachment-copy review and validates edited copy", () => {
    const s = initialState();
    const p = { ...s.people[0], attachment: null };
    expect(validation(p, s.resumes).some(e => e.includes("claims a resume"))).toBe(true);
    p.body = p.body.replace(" I've attached my resume.", "");
    expect(validation(p, s.resumes)).toEqual([]);
    expect(validation({ ...p, subject: "Header\r\nBcc: real@example.com" }, s.resumes).length).toBeGreaterThan(0);
    expect(validation({ ...p, body: p.body + "—" }, s.resumes)).toContain("Remove em dashes before approval.");
  });
  it("freezes a reviewed recruiter message without an attachment after explicit copy correction", () => {
    const state = initialState();
    const recruiter = state.people.find(p => p.id === "recruiters-0")!;
    recruiter.attachment = null;
    recruiter.body = recruiter.body.replace(" I've attached my resume.", "");
    recruiter.userEdited = true;
    const approved = approve(state, recruiter.id);
    const created = lifecycle(approved, recruiter.id, "create");
    const sent = lifecycle(created, recruiter.id, "send");
    const history = sent.people.find(p => p.id === recruiter.id)!.history[0];
    expect(history.attachment).toBeNull();
    expect(history.body).not.toContain("attached my resume");
  });
  it("requires approval then creation then send, freezing content and transferring once", () => {
    const s = initialState();
    expect(lifecycle(s, "recruiters-0", "send")).toBe(s);
    const approved = approve(s, "recruiters-0");
    expect(lifecycle(approved, "recruiters-0", "send")).toBe(approved);
    const created = lifecycle(approved, "recruiters-0", "create");
    const sent = lifecycle(created, "recruiters-0", "send");
    expect(rows(sent, "Drafts", "recruiters").some(p => p.id === "recruiters-0")).toBe(false);
    expect(rows(sent, "Sent", "recruiters").filter(p => p.id === "recruiters-0")).toHaveLength(1);
    expect(sent.people[0].history[0].body).toBe(s.people[0].body);
    expect(sent.people[0].history[0].attachment?.id).toBe("general-v2");
    expect(lifecycle(sent, "recruiters-0", "send")).toBe(sent);
  });
  it("does not rewrite sent attachment evidence when the resume library later changes", () => {
    const approved = approve(initialState(), "recruiters-0");
    const sent = lifecycle(lifecycle(approved, "recruiters-0", "create"), "recruiters-0", "send");
    const frozen = structuredClone(sent.people[0].history[0]);
    sent.resumes[0].active = false;
    sent.resumes[0].label = "Renamed after send";
    sent.defaultResume = "product-v1";
    expect(sent.people[0].history[0]).toEqual(frozen);
    expect(sent.people[0].history[0].attachment).toMatchObject({ id: "general-v2", label: "General Resume", active: true });
  });
  it("finds recruiters despite abundant peers, reports partial results and shares a finite budget", () => {
    const s = initialState();
    expect(capacity(s, "peers").length).toBeGreaterThan(20);
    const first = findMore(s, "recruiters");
    expect(first.people.length - s.people.length).toBe(2);
    expect(first.notice).toContain("2 of 5");
    const second = findMore(first, "recruiters");
    expect(second.notice).toContain("1 of 5");
    expect(second.budgetUsed).toBe(10);
    const blocked = findMore(second, "peers");
    expect(blocked.people).toEqual(second.people);
    expect(blocked.notice).toContain("exhausted");
  });
  it("corrects one existing person while preserving historical interpretation and suppression", () => {
    const s = initialState();
    const original = structuredClone(s.people.find(p => p.id === "executives-2")!);
    const next = correctBucket(s, original.id, "peers");
    const corrected = next.people.find(p => p.id === original.id)!;
    expect(next.people.length).toBe(s.people.length);
    expect(corrected.bucket).toBe("peers");
    expect(corrected.history).toEqual(original.history);
    expect(corrected.block).toBe(original.block);
    expect(corrected.reviewNeeded).toBe(false);
    expect(rows(next, "Sent", "executives").some(p => p.id === original.id)).toBe(true);
    expect(rows(next, "Sent", "peers").some(p => p.id === original.id)).toBe(false);
    expect(capacity(next, "peers").some(p => p.id === original.id)).toBe(false);
  });
  it("keeps the ambiguous contact's identity and truthful historical copy consistent before and after correction", () => {
    const state = initialState();
    const original = state.people.find(p => p.id === "executives-2")!;
    const history = structuredClone(original.history);
    const corrected = correctBucket(state, original.id, "peers").people.find(p => p.id === original.id)!;
    for (const person of [original, corrected]) {
      expect(person.name).toBe("Alexandra-Rose Montgomery-Wells");
      expect(person.function).toBe("client analytics");
      expect(person.body).toMatch(/^Hi Alexandra-Rose,/);
      expect(person.history[0].body).toMatch(/^Hi Alexandra-Rose,/);
      expect(person.history[0].body).toContain(`your work in client analytics at ${person.company}`);
      expect(person.history[0].body).not.toMatch(/Jordan|data platforms|your role leading/i);
      expect(person.history[0].templateVersion).toContain("truthful-alternative");
      expect(person.history[0].bucket).toBe("executives");
      expect(person.history).toEqual(history);
    }
    expect(corrected.bucket).toBe("peers");
    expect(original.bucket).toBe("executives");
  });
  it("does not count uncertain as sent or offer an ordinary send retry", () => {
    const s = initialState();
    expect(rows(s, "Sent", "all").some(p => p.id === "peers-30")).toBe(false);
    expect(lifecycle(s, "peers-30", "send")).toBe(s);
    expect(rows(lifecycle(s, "peers-30", "verify"), "Sent", "peers").some(p => p.id === "peers-30")).toBe(true);
  });
});
