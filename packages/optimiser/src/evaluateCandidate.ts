import type { Eval, EvaluationContext, TallyRunOptions } from '@tally-evals/tally';
import { createTally } from '@tally-evals/tally';
import {
  buildEvalSummariesFromArtifact,
  computeAggregatedPassRate,
  poolEvalSummaries,
} from './evalSummaries';
import type { OptimizationJobStore } from './optimizationJobStore';
import type {
  CandidateAgentEvaluation,
  EvaluateCandidateAgentInput,
  EvaluationPolicy,
} from './types';

export type EvaluateCandidateInput = EvaluateCandidateAgentInput & {
  evals: readonly Eval[];
  evaluationPolicy: EvaluationPolicy;
  context?: EvaluationContext;
  runOptions?: TallyRunOptions;
  store?: OptimizationJobStore;
};

function tallyArtifactPath(reportRunId: string): string {
  return `memory:${reportRunId}`;
}

/**
 * Runs Tally once per trajectory in `candidateAgent.runs`, builds eval evidence via the Phase 3 bridge,
 * pools per-trajectory summaries, and returns a `CandidateAgentEvaluation`.
 */
export async function evaluateCandidate(
  input: EvaluateCandidateInput
): Promise<CandidateAgentEvaluation> {
  const perTrajectory: ReturnType<typeof buildEvalSummariesFromArtifact>[] = [];

  // Run Tally once per trajectory in the candidate agent.
  for (const run of input.candidateAgent.runs) {
    // Create a Tally container for the run.
    const tally = createTally({
      data: [run.conversation],
      evals: input.evals,
      ...(input.context !== undefined ? { context: input.context } : {}),
    });

    // Run Tally and get the report.
    const report =
      input.runOptions !== undefined ? await tally.run(input.runOptions) : await tally.run();

    // Build the eval summaries from the report.
    const artifact = report.toArtifact();
    perTrajectory.push(buildEvalSummariesFromArtifact(artifact));

    // Store the tally artifact reference if a store is provided.
    if (input.store) {
      input.store.putTallyArtifactRef({
        optimizationJobId: input.candidateAgent.optimizationJobId,
        candidateAgentId: input.candidateAgent.candidateAgentId,
        ref: {
          trajectoryId: run.trajectoryId,
          runId: report.runId,
          artifactPath: tallyArtifactPath(report.runId),
        },
      });
    }
  }

  // Pool the eval summaries per trajectory.
  const evalSummaries = poolEvalSummaries(perTrajectory);

  // Compute the aggregated pass rate.
  const aggregatedPassRate = computeAggregatedPassRate(evalSummaries, input.evaluationPolicy);

  return {
    optimizationJobId: input.candidateAgent.optimizationJobId,
    candidateAgentId: input.candidateAgent.candidateAgentId,
    evalSummaries,
    aggregatedPassRate,
  };
}
