/** Domain errors for HRPO / optimization job flows (reused by store, orchestration, later phases). */

import type { OptimizationJobConfig } from './types';

export class JobNotFoundError extends Error {
  readonly name = 'JobNotFoundError';
  constructor(readonly optimizationJobId: string) {
    super(`Optimization job not found: ${optimizationJobId}`);
  }
}

export class TrajectorySetAlreadyAttachedError extends Error {
  readonly name = 'TrajectorySetAlreadyAttachedError';
  constructor(readonly optimizationJobId: string) {
    super(
      `Trajectory set already attached for job ${optimizationJobId}; a job may have at most one set.`
    );
  }
}

export class TallyArtifactRefKeyCollisionError extends Error {
  readonly name = 'TallyArtifactRefKeyCollisionError';
  constructor(readonly key: string) {
    super(
      `TallyArtifactRef key collision: ${key}. A ref is already stored for this job, candidate, trajectory, and runId.`
    );
  }
}

export class InvalidOptimizationConfigError extends Error {
  override readonly name = 'InvalidOptimizationConfigError';

  // biome-ignore lint/complexity/noUselessConstructor: Error subclass; message is the only payload
  constructor(message: string) {
    super(message);
  }
}

export class MismatchedCandidateIdError extends Error {
  override readonly name = 'MismatchedCandidateIdError';
  constructor() {
    super(
      'createCycleOutput: candidatePrompt.candidateAgentId does not match evaluation.candidateAgentId'
    );
  }
}

export class NoCycleOutputsError extends Error {
  override readonly name = 'NoCycleOutputsError';
  constructor(readonly optimizationJobId: string) {
    super(`selectFinalCandidate: no cycle outputs for job ${optimizationJobId}`);
  }
}

export class EmptyCandidatePoolError extends Error {
  override readonly name = 'EmptyCandidatePoolError';
  constructor() {
    super('Internal error: empty candidate pool for final selection');
  }
}

export class PreviousCandidatePromptNotFoundError extends Error {
  override readonly name = 'PreviousCandidatePromptNotFoundError';
  constructor(
    readonly optimizationJobId: string,
    readonly candidateAgentId: string
  ) {
    super(
      `No registered CandidatePrompt for job ${optimizationJobId} and candidate ${candidateAgentId}. Call registerCandidate for the current candidate before createCandidatePrompt.`
    );
  }
}

// ── Config validation (throws domain errors) ───────────────────────────────

function assertKeysInEvalSuite(
  label: string,
  keys: readonly string[],
  evalNames: ReadonlySet<string>
): void {
  for (const k of keys) {
    if (!evalNames.has(k)) {
      throw new InvalidOptimizationConfigError(
        `${label}: unknown eval name "${k}" (not in provided eval suite)`
      );
    }
  }
}

/**
 * Validates `OptimizationJobConfig` and, when `evalNames` is passed, checks that
 * `evalWeights` / `requiredEvals` keys match the suite.
 */
export function assertValidOptimizationJobConfig(
  config: OptimizationJobConfig,
  evalNames?: ReadonlySet<string>
): void {
  if (!Number.isInteger(config.maxCycles) || config.maxCycles < 1) {
    throw new InvalidOptimizationConfigError('maxCycles must be an integer >= 1');
  }
  const t = config.acceptanceThreshold;
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    throw new InvalidOptimizationConfigError('acceptanceThreshold must be in [0, 1]');
  }
  const { evalWeights, requiredEvals } = config.evaluationPolicy;
  for (const [name, w] of Object.entries(evalWeights)) {
    if (!Number.isFinite(w) || w < 0) {
      throw new InvalidOptimizationConfigError(
        `evalWeights[${JSON.stringify(name)}] must be a finite number >= 0`
      );
    }
  }
  if (evalNames) {
    assertKeysInEvalSuite('evalWeights', Object.keys(evalWeights), evalNames);
    if (requiredEvals?.length) {
      assertKeysInEvalSuite('requiredEvals', requiredEvals, evalNames);
    }
  }
}
