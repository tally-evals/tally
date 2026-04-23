/** Domain errors for HRPO / optimization job flows (reused by store, orchestration, later phases). */

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
