import type { Eval, TallyRunArtifact, TallyRunReport, ConversationResult } from '@tally-evals/core';
import { createTargetRunView } from '../views/targetRunView';

/**
 * Create a type-safe TallyRunReport from a run artifact.
 *
 * @param artifact - The raw run artifact
 * @param _evals - Eval definitions for type inference (not used at runtime)
 * @returns Type-safe run report with autocomplete for eval names
 */
export function createTallyRunReport<TEvals extends readonly Eval[] = readonly Eval[]>(
  artifact: TallyRunArtifact,
  _evals?: TEvals, // For type inference only
): TallyRunReport<TEvals> {
  return {
    runId: artifact.runId,
    createdAt: new Date(artifact.createdAt),
    defs: artifact.defs,
    // Cast the string-keyed runtime data to typed accessors
    result: artifact.result as unknown as ConversationResult<TEvals>,
    ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
    view: () => createTargetRunView<TEvals>(artifact, _evals),
    toArtifact: () => artifact,
  };
}
