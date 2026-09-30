/**
 * Reviewed company identities used by the controlled company-specific
 * workflows. An identity is authoritative only as the exact ID + exact domain
 * pair; neither the target-company row nor its display name is sufficient.
 */
export const AUTHORITATIVE_OPERATING_COMPANIES = [
  ["microsoft", "microsoft.com"], ["google", "google.com"], ["amazon", "amazon.com"], ["apple", "apple.com"], ["nvidia", "nvidia.com"], ["palantir", "palantir.com"],
  ["jpmorganchase", "jpmorganchase.com"], ["goldman-sachs", "goldmansachs.com"], ["morgan-stanley", "morganstanley.com"], ["blackrock", "blackrock.com"], ["bloomberg", "bloomberg.com"],
  ["mckinsey-and-company", "mckinsey.com"], ["boston-consulting-group", "bcg.com"], ["bain-and-company", "bain.com"], ["accenture", "accenture.com"], ["deloitte", "deloitte.com"],
  ["rtx", "rtx.com"], ["lockheed-martin", "lockheedmartin.com"], ["northrop-grumman", "northropgrumman.com"], ["anduril", "anduril.com"],
  ["vitol", "vitol.com"], ["trafigura", "trafigura.com"], ["mercuria", "mercuria.com"], ["glencore", "glencore.com"], ["cargill", "cargill.com"], ["shell", "shell.com"], ["bp", "bp.com"], ["chevron", "chevron.com"],
  ["pwc", "pwc.com"], ["ey", "ey.com"], ["kpmg", "kpmg.com"], ["oliver-wyman", "oliverwyman.com"],
  ["citi", "citi.com"], ["bank-of-america", "bankofamerica.com"], ["fidelity-investments", "fidelity.com"], ["state-street", "statestreet.com"], ["capital-one", "capitalone.com"],
  ["datadog", "datadoghq.com"], ["snowflake", "snowflake.com"], ["servicenow", "servicenow.com"], ["ibm", "ibm.com"],
  ["shield-ai", "shield.ai"], ["general-dynamics", "gd.com"], ["l3harris-technologies", "l3harris.com"], ["bae-systems", "baesystems.com"], ["boeing", "boeing.com"],
] as const;

export const AUTHORITATIVE_OPERATING_COMPANY_DOMAINS: Readonly<Record<string, string>> =
  Object.freeze(Object.fromEntries(AUTHORITATIVE_OPERATING_COMPANIES));
