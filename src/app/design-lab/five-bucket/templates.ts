/** Approved prose, versioned independently of personalization and user edits. */
export const TEMPLATE_VERSION = "approved-2026-09-22.v1";
export const CANONICAL = {
  managers: {
    subject: "A question about your career in [field]",
    body: `Hi [First name],

I'm Dylan, a recent computer science graduate from Marist University in Poughkeepsie, New York. I've been working in BI and data engineering, building automations and connecting business systems.

I saw your role at [Company] and wanted to introduce myself. I'm trying to learn as much as I can from people's experiences and success in [field], especially [specific topic].

I would love to connect about your career and how you've approached that part of your work.

Thank you in advance for your guidance,
Dylan`,
  },
  executives: {
    subject: "A question about building toward leadership",
    body: `Hi [First name],

I'm Dylan, a recent computer science graduate from Marist University working in BI and data engineering.

Your role leading [verified function] at [Company] is the kind of responsibility I'd like to grow toward. I'm especially interested in staying close to new technology while taking on more responsibility for people and what gets built.

I'm sure you're extremely busy, but would it be possible to throw 10-15 mins on your calendar for a quick chat?

I promise I'll pay your time forward.

Best,
Dylan`,
  },
  ceos: {
    subject: "Guidance for someone starting out",
    body: `Hi [First name],

I know this is a long shot, but [specific reason for contacting this person] made me want to ask for your guidance.

I'm a recent Marist University computer science graduate working in BI and data engineering. Eventually, I'd like to build useful products and lead a team, and I'm trying to understand what I should focus on now to get there.

I'm sure your calendar is packed, but would you be open to finding 15 minutes for a conversation?

I promise I'll pay your time forward.

Thanks,
Dylan`,
  },
  recruiters: {
    subject: "Early-career data opportunities at [Company]",
    body: `Hi [First name],

I graduated from Marist University in May 2026 with a computer science degree and have hands-on BI and data engineering experience.

I'm looking for my first full-time role in data or analytics and would love to connect about opportunities at [Company]. I've attached my resume.

Would you be open to a brief call?

Best,
Dylan`,
  },
  peers: {
    subject: "Your path into [field]",
    body: `Hi [First name],

I saw you're a [role] at [Company]. I graduated from Marist University in May 2026 and have been working in BI and data engineering while looking for my first full-time role.

I'd be curious how you approached your job search and what helped you get started in [field].

Would you have 15 minutes to talk me through your experience?

Thanks,
Dylan`,
  },
} as const;

export function personalize(text: string, slots: Record<string, string>) {
  return text.replace(/\[([^\]]+)\]/g, (placeholder, key: string) => slots[key] || placeholder);
}
