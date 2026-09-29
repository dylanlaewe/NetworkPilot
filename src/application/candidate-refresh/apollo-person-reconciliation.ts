export const APOLLO_PERSON_RESERVATION_VERSION =
  "apollo-person-reservation-v1" as const;

export type ApolloPersonReservationLifecycle =
  | "reserved-never-attempted"
  | "reconciliation-required"
  | "attempted-result-usable"
  | "released-no-consumption"
  | "consumed-no-import"
  | "completed-imported";

export interface ApolloPersonReservationAuditEvent {
  commandId: string;
  commandFingerprint: string;
  actor: string;
  mechanism: string;
  evidence: string;
  reason: string;
  previousState: ApolloPersonReservationLifecycle | null;
  resultingState: ApolloPersonReservationLifecycle;
  observedConsumption?: number;
  occurredAt: string;
}

export interface ApolloPersonReservationInspection {
  personId: string;
  operationId: string;
  lifecycle: ApolloPersonReservationLifecycle;
  attemptCount: number;
  resultRetained: boolean;
  retainedResultFingerprint: string | null;
  importedCandidateId: string | null;
  personObservedConsumption: number | null;
  consumptionKnown: boolean;
  observedConsumption: number | null;
  reusable: boolean;
  requiresReconciliation: boolean;
  updatedAt: string;
  audit: ApolloPersonReservationAuditEvent[];
}

interface ReconciliationCommandBase {
  commandId: string;
  personId: string;
  operationId: string;
  actor: string;
  mechanism: string;
  evidence: string;
  reason: string;
  at: Date;
}

export type ApolloPersonReconciliationCommand = ReconciliationCommandBase &
  (
    | { outcome: "resume-retained-result" }
    | { outcome: "no-consumption-safe-release" }
    | {
        outcome: "consumed-no-import";
        observedConsumption: number;
      }
  );

export interface ApolloPersonReconciliationResult {
  status: "applied" | "existing";
  before: ApolloPersonReservationInspection;
  after: ApolloPersonReservationInspection;
}

export interface ApolloPersonReconciliationRepository {
  inspectApolloPersonReservation(input: {
    personId: string;
    operationId: string;
  }): ApolloPersonReservationInspection | null;
  reconcileApolloPersonReservation(
    command: ApolloPersonReconciliationCommand,
  ): ApolloPersonReconciliationResult;
}

const identityPattern = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{2,255}$/;

function validateIdentity(value: string, label: string): void {
  if (!identityPattern.test(value)) throw new Error(`${label}-invalid`);
}

function validateEvidence(value: string, label: string): void {
  if (!value.trim() || value.trim().length > 1_000)
    throw new Error(`${label}-required`);
}

/** Read-only/dry inspection. This never changes state or contacts Apollo. */
export function inspectApolloPersonReservation(input: {
  personId: string;
  operationId: string;
  repository: ApolloPersonReconciliationRepository;
}): ApolloPersonReservationInspection | null {
  validateIdentity(input.personId, "apollo-person-id");
  validateIdentity(input.operationId, "apollo-operation-id");
  return input.repository.inspectApolloPersonReservation(input);
}

/**
 * Explicit evidence-backed reconciliation. There is deliberately no generic
 * unlock outcome and no provider dependency in this application boundary.
 */
export function reconcileApolloPersonReservation(input: {
  command: ApolloPersonReconciliationCommand;
  repository: ApolloPersonReconciliationRepository;
}): ApolloPersonReconciliationResult {
  const { command } = input;
  validateIdentity(command.commandId, "apollo-reconciliation-command-id");
  validateIdentity(command.personId, "apollo-person-id");
  validateIdentity(command.operationId, "apollo-operation-id");
  validateEvidence(command.actor, "apollo-reconciliation-actor");
  validateEvidence(command.mechanism, "apollo-reconciliation-mechanism");
  validateEvidence(command.evidence, "apollo-reconciliation-evidence");
  validateEvidence(command.reason, "apollo-reconciliation-reason");
  if (Number.isNaN(command.at.getTime()))
    throw new Error("apollo-reconciliation-time-invalid");
  if (
    command.outcome === "consumed-no-import" &&
    (!Number.isInteger(command.observedConsumption) ||
      command.observedConsumption < 1)
  )
    throw new Error("apollo-reconciliation-consumption-invalid");
  return input.repository.reconcileApolloPersonReservation(command);
}
