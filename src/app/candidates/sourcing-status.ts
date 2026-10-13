export function candidateSourcingStatus(input: {
  enabled: boolean;
  ready: boolean;
}) {
  if (!input.enabled)
    return {
      available: false,
      label: "Find people unavailable",
      detail: "Apollo disabled",
    } as const;
  if (!input.ready)
    return {
      available: false,
      label: "Find people unavailable",
      detail: "Apollo configuration needed",
    } as const;
  return {
    available: true,
    label: "Find people",
    detail: "May use Apollo credits",
  } as const;
}

export function candidateHealthStatus(input: {
  actionableCapacity: number;
  enabled: boolean;
  ready: boolean;
  exposure: number;
  maximumPerDay: number;
}) {
  const prefix = `${input.actionableCapacity} actionable candidates`;
  if (!input.enabled) return `${prefix} · Apollo disabled`;
  if (!input.ready)
    return `${prefix} · Apollo unavailable — configuration needed`;
  if (input.exposure >= input.maximumPerDay)
    return `${prefix} · Local sourcing allowance reached`;
  return `${prefix} · ${Math.max(0, input.maximumPerDay - input.exposure)} local sourcing credits available`;
}
