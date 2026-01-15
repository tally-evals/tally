/**
 * Eval Builder
 *
 * Converts evals to internal evaluator structure for pipeline execution.
 * Handles auto-normalization and creates identity scorers for single-turn/multi-turn evals.
 */

import type {
  MetricDef,
  MetricContainer,
  SingleTurnContainer,
  MultiTurnContainer,
  Scorer,
  ScorerInput,
  BaseMetricDef,
  Score,
  InputScores,
  MetricDefFor,
  Evaluator,
  Aggregator,
} from '@tally/core/types';
import { defineBaseMetric, defineInput, defineScorer } from '../factory';
import type {
  Eval,
  SingleTurnEval,
  MultiTurnEval,
  ScorerEval,
  VerdictPolicy,
} from './types';
import {
  needsAutoNormalization,
  applyAutoNormalization,
  getDefaultAutoNormalizer,
  detectMetricValueType,
} from './normalization';

/**
 * Internal evaluator structure (legacy format for pipeline compatibility)
 * This is what the pipeline expects - metrics + scorer
 */
export interface InternalEvaluator<TContainer extends MetricContainer> {
  name: string;
  description?: string;
  metrics: readonly MetricDefFor<TContainer>[];
  scorer: Scorer;
  context?: import('@tally/core/types').EvaluationContext;
  metadata?: Record<string, unknown>;
  // Eval metadata for verdict computation and aggregation
  evalName: string; // Name of the eval this evaluator represents
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
  verdictPolicy?: VerdictPolicy;
  aggregators?: Aggregator[];
}

/**
 * Build internal evaluators from evals
 * Converts evals to the internal evaluator structure that the pipeline expects
 */
export function buildFromEvals<TContainer extends MetricContainer>(
  evals: readonly Eval<TContainer>[],
): {
  internalEvaluators: InternalEvaluator<TContainer>[];
  evalMetadata: Map<
    string,
    {
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      verdictPolicy?: VerdictPolicy;
      sourceMetrics?: string[]; // Names of raw metrics for this eval
    }
  >;
} {
  const internalEvaluators: InternalEvaluator<TContainer>[] = [];
  const evalMetadata = new Map<
    string,
    {
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      verdictPolicy?: VerdictPolicy;
      sourceMetrics?: string[];
    }
  >();

  // Check for duplicate eval names
  const evalNames = new Set<string>();
  for (const eval_ of evals) {
    if (evalNames.has(eval_.name)) {
      throw new Error(
        `Duplicate eval name: "${eval_.name}". Eval names must be unique.`,
      );
    }
    evalNames.add(eval_.name);
  }

  for (const eval_ of evals) {
    if (eval_.kind === 'singleTurn') {
      const singleTurnEval = eval_ as SingleTurnEval<TContainer>;
      const internalEvaluator = buildSingleTurnEval(singleTurnEval);
      internalEvaluators.push(internalEvaluator);
      evalMetadata.set(eval_.name, {
        evalKind: 'singleTurn',
        verdictPolicy: singleTurnEval.verdict,
        sourceMetrics: internalEvaluator.metrics.map((m) => m.name),
      });
    } else if (eval_.kind === 'multiTurn') {
      const multiTurnEval = eval_ as MultiTurnEval<TContainer>;
      const internalEvaluator = buildMultiTurnEval(multiTurnEval);
      internalEvaluators.push(internalEvaluator);
      evalMetadata.set(eval_.name, {
        evalKind: 'multiTurn',
        verdictPolicy: multiTurnEval.verdict,
        sourceMetrics: internalEvaluator.metrics.map((m) => m.name),
      });
    } else if (eval_.kind === 'scorer') {
      const scorerEval = eval_ as ScorerEval;
      const internalEvaluator = buildScorerEval(scorerEval);
      internalEvaluators.push(internalEvaluator);
      evalMetadata.set(eval_.name, {
        evalKind: 'scorer',
        verdictPolicy: scorerEval.verdict,
        sourceMetrics: internalEvaluator.metrics.map((m) => m.name),
      });
    }
  }

  return { internalEvaluators, evalMetadata };
}

/**
 * Build internal evaluator from single-turn eval
 * Creates an identity scorer (single metric -> single output)
 */
function buildSingleTurnEval<TContainer extends SingleTurnContainer>(
  eval_: SingleTurnEval<TContainer>,
): InternalEvaluator<TContainer> {
  // Apply auto-normalization if needed
  let metric = eval_.metric;
  if (needsAutoNormalization(metric)) {
    const autoNormalizer =
      eval_.autoNormalize ??
      getDefaultAutoNormalizer(detectMetricValueType(metric));
    if (autoNormalizer) {
      const normalization = applyAutoNormalization(metric, autoNormalizer);
      metric = { ...metric, normalization };
    }
  }

  // Create identity scorer: single metric -> single output
  const outputMetric: BaseMetricDef<number> = defineBaseMetric({
    name: `${eval_.name}_score`,
    valueType: 'number',
    description: `Normalized score for ${eval_.name}`,
  });

  const scorerInput: ScorerInput = defineInput({
    metric: metric as MetricDefFor<TContainer>,
    weight: 1.0,
  });

  const scorer: Scorer = defineScorer({
    name: `${eval_.name}_scorer`,
    output: outputMetric,
    inputs: [scorerInput],
    normalizeWeights: false, // Single input, no need to normalize
    combineScores: (scores: InputScores<readonly [ScorerInput]>) => {
      // Identity: return the single input score
      const metricName = metric.name;
      return scores[metricName as keyof typeof scores] as Score;
    },
  });

  return {
    name: `${eval_.name}_evaluator`,
    description: eval_.description,
    metrics: [metric as MetricDefFor<TContainer>],
    scorer,
    context: eval_.context,
    metadata: eval_.metadata,
    evalName: eval_.name,
    evalKind: 'singleTurn',
    verdictPolicy: eval_.verdict,
    aggregators: eval_.aggregators,
  };
}

/**
 * Build internal evaluator from multi-turn eval
 * Creates an identity scorer (single metric -> single output)
 */
function buildMultiTurnEval<TContainer extends MultiTurnContainer>(
  eval_: MultiTurnEval<TContainer>,
): InternalEvaluator<TContainer> {
  // Apply auto-normalization if needed
  let metric = eval_.metric;
  if (needsAutoNormalization(metric)) {
    const autoNormalizer =
      eval_.autoNormalize ??
      getDefaultAutoNormalizer(detectMetricValueType(metric));
    if (autoNormalizer) {
      const normalization = applyAutoNormalization(metric, autoNormalizer);
      metric = { ...metric, normalization };
    }
  }

  // Create identity scorer: single metric -> single output
  const outputMetric: BaseMetricDef<number> = defineBaseMetric({
    name: `${eval_.name}_score`,
    valueType: 'number',
    description: `Normalized score for ${eval_.name}`,
  });

  const scorerInput: ScorerInput = defineInput({
    metric: metric as MetricDefFor<TContainer>,
    weight: 1.0,
  });

  const scorer: Scorer = defineScorer({
    name: `${eval_.name}_scorer`,
    output: outputMetric,
    inputs: [scorerInput],
    normalizeWeights: false, // Single input, no need to normalize
    combineScores: (scores: InputScores<readonly [ScorerInput]>) => {
      // Identity: return the single input score
      const metricName = metric.name;
      return scores[metricName as keyof typeof scores] as Score;
    },
  });

  return {
    name: `${eval_.name}_evaluator`,
    description: eval_.description,
    metrics: [metric as MetricDefFor<TContainer>],
    scorer,
    context: eval_.context,
    metadata: eval_.metadata,
    evalName: eval_.name,
    evalKind: 'multiTurn',
    verdictPolicy: eval_.verdict,
  };
}

/**
 * Build internal evaluator from scorer eval
 * Uses the scorer as-is
 */
function buildScorerEval<TContainer extends MetricContainer>(
  eval_: ScorerEval,
): InternalEvaluator<TContainer> {
  return {
    name: `${eval_.name}_evaluator`,
    description: eval_.description,
    // Cast inputs to container-specific MetricDef list for internal pipeline
    metrics: eval_.inputs as unknown as MetricDefFor<TContainer>[],
    scorer: eval_.scorer,
    context: eval_.context,
    metadata: eval_.metadata,
    evalName: eval_.name,
    evalKind: 'scorer',
    verdictPolicy: eval_.verdict,
  };
}
