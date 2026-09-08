import { describe, expect, it } from "vitest";
import { selectDailyProspects } from "./select-daily-prospects";
import type { OutreachEvent, Prospect, SelectionOptions } from "./types";

const monday = new Date("2026-09-07T14:00:00.000Z");

function prospect(index: number, overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: `person-${index}`,
    firstName: "Jordan",
    lastName: `Person ${index}`,
    companyId: `company-${index}`,
    companyName: `Company ${index}`,
    industry: "Technology",
    email: `person-${index}@example.test`,
    emailVerified: true,
    yearsExperience: 8,
    suppressed: false,
    optedOut: false,
    relevanceScore: 100 - index,
    ...overrides,
  };
}

function options(random = 0, now = monday): SelectionOptions {
  return { random: () => random, now: () => now };
}

function event(person: Prospect, occurredAt: Date): OutreachEvent {
  return { prospectId: person.id, companyId: person.companyId, type: "sent", occurredAt };
}

describe("selectDailyProspects", () => {
  const amplePool = Array.from({ length: 25 }, (_, index) => prospect(index));

  it("selects the minimum daily quantity when randomness is at its lower bound", () => {
    const result = selectDailyProspects(amplePool, [], options(0));
    expect(result.target).toBe(15);
    expect(result.selected).toHaveLength(15);
  });

  it("selects the maximum daily quantity when randomness approaches its upper bound", () => {
    const result = selectDailyProspects(amplePool, [], options(0.999999));
    expect(result.target).toBe(20);
    expect(result.selected).toHaveLength(20);
  });

  it.each(["2026-09-05T14:00:00.000Z", "2026-09-06T14:00:00.000Z"])(
    "suppresses selection on weekend date %s",
    (date) => {
      const result = selectDailyProspects(amplePool, [], options(0.5, new Date(date)));
      expect(result).toMatchObject({ target: 0, selected: [], isWeekday: false, shortfall: 0 });
    },
  );

  it("selects no more than one person per company and keeps the most relevant", () => {
    const lower = prospect(1, { companyId: "shared", relevanceScore: 50 });
    const higher = prospect(2, { companyId: "shared", relevanceScore: 99 });
    const result = selectDailyProspects([lower, higher], [], options());
    expect(result.selected).toEqual([higher]);
  });

  it("enforces the company cooldown and allows a company at the seven-day boundary", () => {
    const oldPerson = prospect(99, { companyId: "recent-company" });
    const blocked = prospect(1, { companyId: "recent-company" });
    const allowed = prospect(2, { companyId: "boundary-company" });
    const history = [
      event(oldPerson, new Date("2026-09-01T14:00:00.000Z")),
      event(prospect(98, { companyId: "boundary-company" }), new Date("2026-08-31T14:00:00.000Z")),
    ];
    const result = selectDailyProspects([blocked, allowed], history, options());
    expect(result.selected).toEqual([allowed]);
  });

  it("never selects a previously contacted individual", () => {
    const candidate = prospect(1);
    const result = selectDailyProspects([candidate], [event(candidate, new Date("2020-01-01"))], options());
    expect(result.selected).toEqual([]);
  });

  it("filters suppressed and opted-out people", () => {
    const result = selectDailyProspects(
      [prospect(1, { suppressed: true }), prospect(2, { optedOut: true }), prospect(3)],
      [],
      options(),
    );
    expect(result.selected.map(({ id }) => id)).toEqual(["person-3"]);
  });

  it("filters unverified email addresses", () => {
    const result = selectDailyProspects(
      [prospect(1, { emailVerified: false }), prospect(2)],
      [],
      options(),
    );
    expect(result.selected.map(({ id }) => id)).toEqual(["person-2"]);
  });

  it("filters people below the minimum experience threshold", () => {
    const result = selectDailyProspects(
      [prospect(1, { yearsExperience: 4.99 }), prospect(2, { yearsExperience: 5 })],
      [],
      options(),
    );
    expect(result.selected.map(({ id }) => id)).toEqual(["person-2"]);
  });

  it("returns fewer prospects and reports a shortfall when the pool is insufficient", () => {
    const result = selectDailyProspects([prospect(1), prospect(2)], [], options());
    expect(result.selected).toHaveLength(2);
    expect(result.target).toBe(15);
    expect(result.shortfall).toBe(13);
  });

  it("prioritizes relevance rather than randomizing candidates", () => {
    const result = selectDailyProspects(
      [prospect(1, { relevanceScore: 20 }), prospect(2, { relevanceScore: 90 })],
      [],
      options(),
    );
    expect(result.selected.map(({ id }) => id)).toEqual(["person-2", "person-1"]);
  });

  it.each([
    { minimumDailyTarget: -1 },
    { minimumDailyTarget: 21, maximumDailyTarget: 20 },
    { companyCooldownDays: 1.5 },
    { minimumYearsExperience: Number.NaN },
  ])("rejects invalid configuration: %o", (config) => {
    expect(() => selectDailyProspects([], [], { ...options(), config })).toThrow(RangeError);
  });

  it.each([-0.01, 1, Number.NaN])("rejects invalid random output: %s", (sample) => {
    expect(() => selectDailyProspects([], [], options(sample))).toThrow(RangeError);
  });
});
