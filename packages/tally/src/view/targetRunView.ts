import type {
  TallyRunArtifact,
  TargetRunView,
  StepResults,
  StepResultsWithIndex,
  ConversationResults,
  SummaryResults,
  RunDefs,
  MetricDefSnap,
  EvalDefSnap,
  ScorerDefSnap,
  Eval,
  StepEvalResult,
  ConversationEvalResult,
} from '@tally-evals/core';

/**
 * Implementation of the type-safe TargetRunView.
 * All methods are lazy projections over the underlying artifact data.
 *
 * @typeParam TEvals - Tuple of eval definitions for type-safe access.
 */
export class TargetRunViewImpl<TEvals extends readonly Eval[]>
  implements TargetRunView<TEvals>
{
  constructor(private readonly artifact: TallyRunArtifact) {}

  get stepCount(): number {
    return this.artifact.result.stepCount;
  }

  get defs(): RunDefs {
    return this.artifact.defs;
  }

  step(index: number): StepResults<TEvals> {
    const result: Record<string, StepEvalResult> = {};

    // Single-turn evals
    for (const [evalName, series] of Object.entries(
      this.artifact.result.singleTurn ?? {}
    )) {
      const stepResult = series.byStepIndex?.[index];
      if (stepResult) result[evalName] = stepResult;
    }

    // Scorers with step-indexed shape
    for (const [evalName, scorer] of Object.entries(
      this.artifact.result.scorers ?? {}
    )) {
      if (scorer.shape === 'seriesByStepIndex') {
        const stepResult = scorer.series?.byStepIndex?.[index];
        if (stepResult) result[evalName] = stepResult;
      }
    }

    return result as StepResults<TEvals>;
  }

  *steps(): Generator<StepResultsWithIndex<TEvals>, void, unknown> {
    for (let i = 0; i < this.stepCount; i++) {
      yield { index: i, ...this.step(i) } as StepResultsWithIndex<TEvals>;
    }
  }

  conversation(): ConversationResults<TEvals> {
    const result: Record<string, ConversationEvalResult> = {};

    // Multi-turn evals
    for (const [evalName, convResult] of Object.entries(
      this.artifact.result.multiTurn ?? {}
    )) {
      result[evalName] = convResult;
    }

    // Scorers with scalar shape
    for (const [evalName, scorer] of Object.entries(
      this.artifact.result.scorers ?? {}
    )) {
      if (scorer.shape === 'scalar') {
        result[evalName] = scorer.result;
      }
    }

    return result as ConversationResults<TEvals>;
  }

  summary(): SummaryResults<TEvals> | undefined {
    if (!this.artifact.result.summaries?.byEval) return undefined;
    return this.artifact.result.summaries.byEval as SummaryResults<TEvals>;
  }

  metric(name: string): MetricDefSnap | undefined {
    return this.artifact.defs.metrics?.[name];
  }

  eval<K extends string>(name: K): EvalDefSnap | undefined {
    return this.artifact.defs.evals?.[name];
  }

  scorer(name: string): ScorerDefSnap | undefined {
    return this.artifact.defs.scorers?.[name];
  }

  metricForEval<K extends string>(evalName: K): MetricDefSnap | undefined {
    const evalDef = this.eval(evalName);
    if (!evalDef?.metric) return undefined;
    return this.metric(evalDef.metric);
  }
}

/**
 * Create a type-safe view over a run artifact.
 *
 * @param artifact - The run artifact to create a view over
 * @param _evals - Optional evals tuple for type inference (not used at runtime)
 * @returns Type-safe view with eval name autocomplete
 */
export function createTargetRunView<TEvals extends readonly Eval[]>(
  artifact: TallyRunArtifact,
  _evals?: TEvals // For type inference only
): TargetRunView<TEvals> {
  return new TargetRunViewImpl<TEvals>(artifact);
}
