/**
 * Eval Builder
 *
 * Converts evals to internal evaluator structure for pipeline execution.
 * Handles auto-normalization and creates identity scorers for single-turn/multi-turn evals.
 */

import type {
  BaseMetricDef,
  Eval,
  EvaluationContext,
  InputScores,
  MetricContainer,
  MetricDef,
  MetricDefFor,
  MetricScalar,
  MultiTurnContainer,
  MultiTurnEval,
  Score,
  Scorer,
  ScorerEval,
  ScorerInput,
  SingleTurnContainer,
  SingleTurnEval,
  VerdictPolicy,
} from '@tally/core/types';
import { defineBaseMetric, defineInput, defineScorer } from '../primitives';
import {
  applyAutoNormalization,
  detectMetricValueType,
  getDefaultAutoNormalizer,
  needsAutoNormalization,
} from './normalization';

/**
 * Internal evaluator structure (legacy format for pipeline compatibility)
 * This is what the pipeline expects - metrics + scorer
 *
 * Note: Using explicit `| undefined` instead of `?` for exactOptionalPropertyTypes compatibility
 */
export interface InternalEvaluator<TContainer extends MetricContainer> {
  name: string;
  description: string | undefined;
  metrics: readonly MetricDefFor<TContainer>[];
  scorer: Scorer;
  context: EvaluationContext | undefined;
  metadata: Record<string, unknown> | undefined;
  // Eval metadata for verdict computation and aggregation
  evalName: string; // Name of the eval this evaluator represents
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
  verdictPolicy: VerdictPolicy | undefined;
}

/**
 * Build internal evaluators from evals
 * Converts evals to the internal evaluator structure that the pipeline expects
 */
/**
 * Eval metadata entry for tracking eval state
 */
export interface EvalMetadataEntry {
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
  verdictPolicy: VerdictPolicy | undefined;
  sourceMetrics: string[] | undefined;
}

export function buildFromEvals(
  evals: readonly Eval[]
): {
  internalEvaluators: InternalEvaluator<MetricContainer>[];
  evalMetadata: Map<string, EvalMetadataEntry>;
} {
  const internalEvaluators: InternalEvaluator<MetricContainer>[] = [];
  const evalMetadata = new Map<string, EvalMetadataEntry>();

  // Check for duplicate eval names
  const evalNames = new Set<string>();
  for (const evalDef of evals) {
    if (evalNames.has(evalDef.name)) {
      throw new Error(`Duplicate eval name: "${evalDef.name}". Eval names must be unique.`);
    }
    evalNames.add(evalDef.name);
  }

  for (const evalDef of evals) {
    if (evalDef.kind === 'singleTurn') {
      const singleTurnDef = evalDef as SingleTurnEval<string, SingleTurnContainer, MetricScalar>;
      const internalEvaluator = buildSingleTurnEval(singleTurnDef);
      internalEvaluators.push(internalEvaluator as InternalEvaluator<MetricContainer>);
      const entry: EvalMetadataEntry = {
        evalKind: 'singleTurn',
        verdictPolicy: singleTurnDef.verdict as VerdictPolicy | undefined,
        sourceMetrics: internalEvaluator.metrics.map((m) => m.name),
      };
      evalMetadata.set(evalDef.name, entry);
    } else if (evalDef.kind === 'multiTurn') {
      const multiTurnDef = evalDef as MultiTurnEval<string, MultiTurnContainer, MetricScalar>;
      const internalEvaluator = buildMultiTurnEval(multiTurnDef);
      internalEvaluators.push(internalEvaluator as InternalEvaluator<MetricContainer>);
      const entry: EvalMetadataEntry = {
        evalKind: 'multiTurn',
        verdictPolicy: multiTurnDef.verdict as VerdictPolicy | undefined,
        sourceMetrics: internalEvaluator.metrics.map((m) => m.name),
      };
      evalMetadata.set(evalDef.name, entry);
    } else if (evalDef.kind === 'scorer') {
      const scorerDef = evalDef as ScorerEval<string>;
      const internalEvaluator = buildScorerEval(scorerDef);
      internalEvaluators.push(internalEvaluator as InternalEvaluator<MetricContainer>);
      const entry: EvalMetadataEntry = {
        evalKind: 'scorer',
        verdictPolicy: scorerDef.verdict as VerdictPolicy | undefined,
        sourceMetrics: internalEvaluator.metrics.map((m) => m.name),
      };
      evalMetadata.set(evalDef.name, entry);
    }
  }

  return { internalEvaluators, evalMetadata };
}

/**
 * Build internal evaluator from single-turn eval
 * Creates an identity scorer (single metric -> single output)
 */
function buildSingleTurnEval(
  definition: SingleTurnEval<string, SingleTurnContainer, MetricScalar>
): InternalEvaluator<SingleTurnContainer> {
  // Apply auto-normalization if needed
  // Cast to MetricDef for internal processing - the eval union guarantees valid metric
  let metric = definition.metric as MetricDef<MetricScalar, MetricContainer>;
  if (needsAutoNormalization(metric)) {
    const autoNormalizer =
      definition.autoNormalize ?? getDefaultAutoNormalizer(detectMetricValueType(metric));
    if (autoNormalizer) {
      const normalization = applyAutoNormalization(metric, autoNormalizer);
      metric = { ...metric, normalization };
    }
  }

  // Create identity scorer: single metric -> single output
  const outputMetric: BaseMetricDef<number> = defineBaseMetric({
    name: `${definition.name}_score`,
    valueType: 'number',
    description: `Normalized score for ${definition.name}`,
  });

  const scorerInput: ScorerInput = defineInput({
    metric: metric as MetricDefFor<SingleTurnContainer>,
    weight: 1.0,
  });

  const scorer: Scorer = defineScorer({
    name: `${definition.name}_scorer`,
    output: outputMetric,
    inputs: [scorerInput],
    normalizeWeights: false, // Single input, no need to normalize
    combineScores: (scores: InputScores<readonly [ScorerInput]>) => {
      // Identity scorer: single input -> single output
      // For single-input scorers, get the first (and only) score value
      const scoreValues = Object.values(scores) as Score[];
      const score = scoreValues[0];
      if (score === undefined) {
        throw new Error(`No score found for metric ${metric.name}`);
      }
      return score;
    },
  });

  const result: InternalEvaluator<SingleTurnContainer> = {
    name: `${definition.name}_evaluator`,
    description: definition.description,
    metrics: [metric as MetricDefFor<SingleTurnContainer>],
    scorer,
    context: definition.context,
    metadata: definition.metadata,
    evalName: definition.name,
    evalKind: 'singleTurn',
    verdictPolicy: definition.verdict as VerdictPolicy | undefined,
  };
  return result;
}

/**
 * Build internal evaluator from multi-turn eval
 * Creates an identity scorer (single metric -> single output)
 */
function buildMultiTurnEval(
  definition: MultiTurnEval<string, MultiTurnContainer, MetricScalar>
): InternalEvaluator<MultiTurnContainer> {
  // Apply auto-normalization if needed
  let metric = definition.metric as MetricDef<MetricScalar, MetricContainer>;
  if (needsAutoNormalization(metric)) {
    const autoNormalizer =
      definition.autoNormalize ?? getDefaultAutoNormalizer(detectMetricValueType(metric));
    if (autoNormalizer) {
      const normalization = applyAutoNormalization(metric, autoNormalizer);
      metric = { ...metric, normalization };
    }
  }

  // Create identity scorer: single metric -> single output
  const outputMetric: BaseMetricDef<number> = defineBaseMetric({
    name: `${definition.name}_score`,
    valueType: 'number',
    description: `Normalized score for ${definition.name}`,
  });

  const scorerInput: ScorerInput = defineInput({
    metric: metric as MetricDefFor<MultiTurnContainer>,
    weight: 1.0,
  });

  const scorer: Scorer = defineScorer({
    name: `${definition.name}_scorer`,
    output: outputMetric,
    inputs: [scorerInput],
    normalizeWeights: false, // Single input, no need to normalize
    combineScores: (scores: InputScores<readonly [ScorerInput]>) => {
      // Identity scorer: single input -> single output
      // For single-input scorers, get the first (and only) score value
      const scoreValues = Object.values(scores) as Score[];
      const score = scoreValues[0];
      if (score === undefined) {
        throw new Error(`No score found for metric ${metric.name}`);
      }
      return score;
    },
  });

  const result: InternalEvaluator<MultiTurnContainer> = {
    name: `${definition.name}_evaluator`,
    description: definition.description,
    metrics: [metric as MetricDefFor<MultiTurnContainer>],
    scorer,
    context: definition.context,
    metadata: definition.metadata,
    evalName: definition.name,
    evalKind: 'multiTurn',
    verdictPolicy: definition.verdict as VerdictPolicy | undefined,
  };
  return result;
}

/**
 * Build internal evaluator from scorer eval
 * Uses the scorer as-is
 */
function buildScorerEval(
  definition: ScorerEval<string>
): InternalEvaluator<MetricContainer> {
  const inputMetrics = (definition.scorer.inputs as readonly { metric: unknown }[]).map(
    (input) => input.metric,
  );

  const result: InternalEvaluator<MetricContainer> = {
    name: `${definition.name}_evaluator`,
    description: definition.description,
    // Derive dependency metrics directly from scorer inputs
    metrics: inputMetrics as unknown as MetricDefFor<MetricContainer>[],
    scorer: definition.scorer,
    context: definition.context,
    metadata: definition.metadata,
    evalName: definition.name,
    evalKind: 'scorer',
    verdictPolicy: definition.verdict as VerdictPolicy | undefined,
  };
  return result;
}
