/** Count independent requests, not punctuation; synonymous connection clauses share one ask. */
export function primaryAskCount(body: string): number {
  const requests = body.split(/(?<=[.!?])\s+|\n\s*\n/).map(s => s.trim()).filter(s => /\b(would you|could you|can you|could I|may I|can I|would it be possible|would love to|please (?:send|share|introduce|refer|review|connect)|let(?:'|’)s)\b/i.test(s));
  const groups = new Set<string>();
  let distinct = 0;
  for (const request of requests) {
    if (/\b(resume|résumé|cv)\b/i.test(request) && /\b(send|review|forward|share)\b/i.test(request)) groups.add("resume-request");
    else if (/\b(referral|refer me|introduce me|introduction to)\b/i.test(request)) groups.add("referral-request");
    else if (/\b(connect|call|chat|conversation|talk|calendar|minutes|mins)\b/i.test(request)) groups.add("conversation");
    else distinct++;
    // A coordinated second request must not disappear inside the first invitation.
    if (/\b(?:and|also)\s+(?:please\s+)?(?:send|share|forward|refer|introduce|review)\b/i.test(request)) distinct++;
  }
  return groups.size + distinct;
}
