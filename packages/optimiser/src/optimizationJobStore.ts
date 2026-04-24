import type { Trajectory } from '@tally-evals/trajectories';
import {
  JobNotFoundError,
  TallyArtifactRefKeyCollisionError,
  TrajectorySetAlreadyAttachedError,
} from './errors';
import type {
  CandidateAgentEvaluation,
  CandidatePrompt,
  CreateTrajectorySetInput,
  CycleOutput,
  OptimizationJob,
  OptimizationJobConfig,
  TallyArtifactRef,
  TrajectorySet,
} from './types';

// ── Types ───────────────────────────────────────────────────────────────────

/** One fixed trajectory set per job: API shape plus stable id ↔ trajectory rows. */
export type AttachedTrajectorySet<T = Trajectory> = {
  trajectorySet: TrajectorySet;
  /** Parallel to `trajectories`; same order as `trajectorySet.trajectoryIds`. */
  trajectoryIds: readonly string[];
  trajectories: readonly T[];
};

function artifactRefKey(
  optimizationJobId: string,
  candidateAgentId: string,
  trajectoryId: string,
  runId: string
): string {
  return `${optimizationJobId}\0${candidateAgentId}\0${trajectoryId}\0${runId}`;
}

/*
creates a simpler key just for the pair (job, candidate).
That is used for things like storing prompts and evaluations.

jobCandidateKey("job1", "cand1") // "job1\0cand1"
jobCandidateKey("job1", "cand2") // "job1\0cand2"
*/
function jobCandidateKey(optimizationJobId: string, candidateAgentId: string): string {
  return `${optimizationJobId}\0${candidateAgentId}`;
}

// ── Interface ────────────────────────────────────────────────────────────────

export type OptimizationJobStore = {
  createJob: (config: OptimizationJobConfig) => OptimizationJob;
  getJob: (optimizationJobId: string) => OptimizationJob | undefined;

  /** Fails if the job has no job row or a trajectory set is already attached. */
  attachTrajectorySet: <T extends Trajectory = Trajectory>(
    input: CreateTrajectorySetInput<T>
  ) => AttachedTrajectorySet<T>;
  getAttachedTrajectorySet: <T = Trajectory>(
    optimizationJobId: string
  ) => AttachedTrajectorySet<T> | undefined;

  registerCandidate: (input: {
    optimizationJobId: string;
    candidateAgentId: string;
    prompt: CandidatePrompt;
  }) => void;
  getCandidatePrompt: (
    optimizationJobId: string,
    candidateAgentId: string
  ) => CandidatePrompt | undefined;

  putCandidateAgentEvaluation: (
    optimizationJobId: string,
    candidateAgentId: string,
    evaluation: CandidateAgentEvaluation
  ) => void;
  getCandidateAgentEvaluation: (
    optimizationJobId: string,
    candidateAgentId: string
  ) => CandidateAgentEvaluation | undefined;

  putCycleOutput: (output: CycleOutput) => void;
  getCycleOutput: (cycleOutputId: string) => CycleOutput | undefined;
  listCycleOutputs: (optimizationJobId: string) => readonly CycleOutput[];

  /**
   * Indexes a ref by (job, candidate, trajectory, run). The same (trajectoryId, runId) may appear
   * for different candidates; keys never conflate two candidates.
   */
  putTallyArtifactRef: (input: {
    optimizationJobId: string;
    candidateAgentId: string;
    ref: TallyArtifactRef;
  }) => void;
  getTallyArtifactRef: (input: {
    optimizationJobId: string;
    candidateAgentId: string;
    trajectoryId: string;
    runId: string;
  }) => TallyArtifactRef | undefined;
  listTallyArtifactRefsForCandidate: (
    optimizationJobId: string,
    candidateAgentId: string
  ) => readonly TallyArtifactRef[];
};

// ── In-memory implementation ─────────────────────────────────────────────────

function newJobId(): string {
  return crypto.randomUUID();
}

/**
 * In-memory `OptimizationJobStore` using `Map` structures. No persistence.
 */
export class InMemoryOptimizationJobStore implements OptimizationJobStore {
  readonly #jobs = new Map<string, OptimizationJob>();
  readonly #trajectorySets = new Map<string, AttachedTrajectorySet>();
  readonly #candidatePrompts = new Map<string, CandidatePrompt>();
  readonly #evaluations = new Map<string, CandidateAgentEvaluation>();
  readonly #cycleOutputs = new Map<string, CycleOutput>();
  readonly #cycleOutputIdsByJob = new Map<string, string[]>();
  // artifact by full (job, candidate, trajectory, run) key
  readonly #artifactRefs = new Map<string, TallyArtifactRef>();
  // helper index to list all artifacts for one candidate
  readonly #artifactRefKeysByCandidate = new Map<string, string[]>();

  createJob(config: OptimizationJobConfig): OptimizationJob {
    const optimizationJobId = newJobId();
    const job: OptimizationJob = {
      optimizationJobId,
      config,
      createdAt: new Date().toISOString(),
    };
    this.#jobs.set(optimizationJobId, job);
    this.#cycleOutputIdsByJob.set(optimizationJobId, []);
    return job;
  }

  getJob(optimizationJobId: string): OptimizationJob | undefined {
    return this.#jobs.get(optimizationJobId);
  }

  attachTrajectorySet<T extends Trajectory>(
    input: CreateTrajectorySetInput<T>
  ): AttachedTrajectorySet<T> {
    const job = this.#jobs.get(input.optimizationJobId);
    if (!job) {
      throw new JobNotFoundError(input.optimizationJobId);
    }
    if (this.#trajectorySets.has(input.optimizationJobId)) {
      throw new TrajectorySetAlreadyAttachedError(input.optimizationJobId);
    }
    const trajectories = input.trajectories;
    const trajectoryIds = trajectories.map((_, i) => `trj-${i}`) as readonly string[];
    const trajectorySet: TrajectorySet = {
      trajectoryIds: [...trajectoryIds],
      createdAt: new Date().toISOString(),
    };
    const row: AttachedTrajectorySet<T> = { trajectorySet, trajectoryIds, trajectories };
    this.#trajectorySets.set(input.optimizationJobId, row);
    return row;
  }

  getAttachedTrajectorySet<T = Trajectory>(
    optimizationJobId: string
  ): AttachedTrajectorySet<T> | undefined {
    return this.#trajectorySets.get(optimizationJobId) as AttachedTrajectorySet<T> | undefined;
  }

  registerCandidate(input: {
    optimizationJobId: string;
    candidateAgentId: string;
    prompt: CandidatePrompt;
  }): void {
    const job = this.#jobs.get(input.optimizationJobId);
    if (!job) {
      throw new JobNotFoundError(input.optimizationJobId);
    }
    this.#candidatePrompts.set(
      jobCandidateKey(input.optimizationJobId, input.candidateAgentId),
      input.prompt
    );
  }

  getCandidatePrompt(
    optimizationJobId: string,
    candidateAgentId: string
  ): CandidatePrompt | undefined {
    return this.#candidatePrompts.get(jobCandidateKey(optimizationJobId, candidateAgentId));
  }

  putCandidateAgentEvaluation(
    optimizationJobId: string,
    candidateAgentId: string,
    evaluation: CandidateAgentEvaluation
  ): void {
    const job = this.#jobs.get(optimizationJobId);
    if (!job) {
      throw new JobNotFoundError(optimizationJobId);
    }
    this.#evaluations.set(jobCandidateKey(optimizationJobId, candidateAgentId), evaluation);
  }

  getCandidateAgentEvaluation(
    optimizationJobId: string,
    candidateAgentId: string
  ): CandidateAgentEvaluation | undefined {
    return this.#evaluations.get(jobCandidateKey(optimizationJobId, candidateAgentId));
  }

  putCycleOutput(output: CycleOutput): void {
    const job = this.#jobs.get(output.optimizationJobId);
    if (!job) {
      throw new JobNotFoundError(output.optimizationJobId);
    }
    this.#cycleOutputs.set(output.cycleOutputId, output);
    const list = this.#cycleOutputIdsByJob.get(output.optimizationJobId) ?? [];
    if (!list.includes(output.cycleOutputId)) {
      list.push(output.cycleOutputId);
    }
    this.#cycleOutputIdsByJob.set(output.optimizationJobId, list);
  }

  getCycleOutput(cycleOutputId: string): CycleOutput | undefined {
    return this.#cycleOutputs.get(cycleOutputId);
  }

  listCycleOutputs(optimizationJobId: string): readonly CycleOutput[] {
    const ids = this.#cycleOutputIdsByJob.get(optimizationJobId) ?? [];
    const out: CycleOutput[] = [];
    for (const id of ids) {
      const row = this.#cycleOutputs.get(id);
      if (row) out.push(row);
    }
    return out;
  }

  putTallyArtifactRef(input: {
    optimizationJobId: string;
    candidateAgentId: string;
    ref: TallyArtifactRef;
  }): void {
    const job = this.#jobs.get(input.optimizationJobId);
    if (!job) {
      throw new JobNotFoundError(input.optimizationJobId);
    }
    const { ref } = input;
    const key = artifactRefKey(
      input.optimizationJobId,
      input.candidateAgentId,
      ref.trajectoryId,
      ref.runId
    );
    if (this.#artifactRefs.has(key)) {
      throw new TallyArtifactRefKeyCollisionError(key);
    }
    this.#artifactRefs.set(key, ref);
    const ckey = jobCandidateKey(input.optimizationJobId, input.candidateAgentId);
    const keys = this.#artifactRefKeysByCandidate.get(ckey) ?? [];
    keys.push(key);
    this.#artifactRefKeysByCandidate.set(ckey, keys);
  }

  getTallyArtifactRef(input: {
    optimizationJobId: string;
    candidateAgentId: string;
    trajectoryId: string;
    runId: string;
  }): TallyArtifactRef | undefined {
    return this.#artifactRefs.get(
      artifactRefKey(
        input.optimizationJobId,
        input.candidateAgentId,
        input.trajectoryId,
        input.runId
      )
    );
  }

  listTallyArtifactRefsForCandidate(
    optimizationJobId: string,
    candidateAgentId: string
  ): readonly TallyArtifactRef[] {
    const ckey = jobCandidateKey(optimizationJobId, candidateAgentId);
    const keys = this.#artifactRefKeysByCandidate.get(ckey) ?? [];
    const out: TallyArtifactRef[] = [];
    for (const k of keys) {
      const r = this.#artifactRefs.get(k);
      if (r) out.push(r);
    }
    return out;
  }
}

export function createInMemoryOptimizationJobStore(): OptimizationJobStore {
  return new InMemoryOptimizationJobStore();
}
