/** Pure copy check safe for both server validation and client review hints. */
export function hasResumeAttachmentClaim(body:string):boolean{
  return /\b(?:(?:my|the)\s+)?(?:resume|résumé|cv)\s+(?:is\s+)?(?:attached|enclosed)\b|\b(?:attached|attaching|enclosed)\s+(?:my\s+|the\s+)?(?:resume|résumé|cv)\b|\bsee\s+(?:my\s+|the\s+)?attached\s+(?:resume|résumé|cv)\b/i.test(body);
}
