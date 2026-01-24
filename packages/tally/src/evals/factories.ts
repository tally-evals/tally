/**
 * Eval Factory Functions
 *
 * Factory functions with "define" semantics and type inference.
 * These factories create eval configurations with type-safe verdict policies.
 */

import type {
  EvaluationContext,
  MetricDef,
  MetricScalar,
  MultiTurnContainer,
  MultiTurnMetricDef,
  SingleTurnContainer,
  SingleTurnMetricDef,
} from '@tally/core/types';
import type { Scorer } from '@tally/core/types';
import type {
  AutoNormalizer,
  MultiTurnEval,
  ScorerEval,
  SingleTurnEval,
  VerdictPolicyFor,
} from '../core/evals/types';

/**
 * Creates a single-turn eval with type inference.
 *
 * Verdict policy type is automatically inferred from metric value type.
 * Uses `const TName` to preserve literal name types for type-safe reports.
 *
 * @typeParam TName - Literal eval name (preserved for type-safe report access)
 * @typeParam TContainer - Container type
 * @typeParam TMetric - Metric definition type
 * @typeParam TMetricValue - Metric value type (inferred from metric)
 *
 * @example
 * ```typescript
 * const eval = defineSingleTurnEval({
 *   name: 'relevance',
 *   metric: relevanceMetric,
 *   verdict: thresholdVerdict(0.8),
 * });
 * ```
 */
export function defineSingleTurnEval<
  const TName extends string,
  TContainer extends SingleTurnContainer,
  // biome-ignore lint/suspicious/noExplicitAny: Required for metric type inference
  TMetric extends SingleTurnMetricDef<any, TContainer>,
  // Infer raw value type from the provided metric, mirroring defineInput pattern
  // biome-ignore lint/suspicious/noExplicitAny: Required for metric type inference
  TMetricValue extends MetricScalar = TMetric extends SingleTurnMetricDef<
    infer T,
    // biome-ignore lint/suspicious/noExplicitAny: Required for metric type inference
    any
  >
    ? T
    : MetricScalar,
>(args: {
  name: TName;
  description?: string;
  metric: TMetric;
  verdict?: VerdictPolicyFor<TMetricValue>;
  autoNormalize?: AutoNormalizer;
  context?: EvaluationContext;
  metadata?: Record<string, unknown>;
}): SingleTurnEval<TName, TContainer, TMetricValue> {
  return {
    kind: 'singleTurn',
    name: args.name,
    ...(args.description !== undefined
      ? { description: args.description }
      : {}),
    // Cast to MetricDef to avoid generic variance issues (pattern mirrors defineInput)
    metric: args.metric as unknown as MetricDef<TMetricValue, TContainer>,
    ...(args.verdict !== undefined ? { verdict: args.verdict } : {}),
    ...(args.autoNormalize !== undefined
      ? { autoNormalize: args.autoNormalize }
      : {}),
    ...(args.context !== undefined ? { context: args.context } : {}),
    ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
  };
}

/**
 * Creates a multi-turn eval with type inference.
 *
 * Verdict policy type is automatically inferred from metric value type.
 * Uses `const TName` to preserve literal name types for type-safe reports.
 *
 * @typeParam TName - Literal eval name (preserved for type-safe report access)
 * @typeParam TContainer - Container type
 * @typeParam TMetric - Metric definition type
 * @typeParam TMetricValue - Metric value type (inferred from metric)
 *
 * @example
 * ```typescript
 * const eval = defineMultiTurnEval({
 *   name: 'goalCompletion',
 *   metric: goalCompletionMetric,
 *   verdict: thresholdVerdict(0.7),
 * });
 * ```
 */
export function defineMultiTurnEval<
  const TName extends string,
  TContainer extends MultiTurnContainer,
  // biome-ignore lint/suspicious/noExplicitAny: Required for metric type inference
  TMetric extends MultiTurnMetricDef<any, TContainer>,
  // Infer raw value type from the provided metric, mirroring defineInput pattern
  // biome-ignore lint/suspicious/noExplicitAny: Required for metric type inference
  TMetricValue extends MetricScalar = TMetric extends MultiTurnMetricDef<
    infer T,
    // biome-ignore lint/suspicious/noExplicitAny: Required for metric type inference
    any
  >
    ? T
    : MetricScalar,
>(args: {
  name: TName;
  description?: string;
  metric: TMetric;
  verdict?: VerdictPolicyFor<TMetricValue>;
  autoNormalize?: AutoNormalizer;
  context?: EvaluationContext;
  metadata?: Record<string, unknown>;
}): MultiTurnEval<TName, TContainer, TMetricValue> {
  return {
    kind: 'multiTurn',
    name: args.name,
    ...(args.description !== undefined
      ? { description: args.description }
      : {}),
    // Cast to MetricDef to avoid generic variance issues (pattern mirrors defineInput)
    metric: args.metric as unknown as MetricDef<TMetricValue, TContainer>,
    ...(args.verdict !== undefined ? { verdict: args.verdict } : {}),
    ...(args.autoNormalize !== undefined
      ? { autoNormalize: args.autoNormalize }
      : {}),
    ...(args.context !== undefined ? { context: args.context } : {}),
    ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
  };
}

/**
 * Creates a scorer eval.
 *
 * Verdict policy is always number-based (Score output).
 * Uses `const TName` to preserve literal name types for type-safe reports.
 *
 * @typeParam TName - Literal eval name (preserved for type-safe report access)
 *
 * @example
 * ```typescript
 * const eval = defineScorerEval({
 *   name: 'qualityScore',
 *   scorer: qualityScorer,
 *   verdict: thresholdVerdict(0.75),
 * });
 * ```
 */
export function defineScorerEval<const TName extends string>(args: {
  name: TName;
  description?: string;
  scorer: Scorer;
  verdict?: VerdictPolicyFor<number>;
  context?: EvaluationContext;
  metadata?: Record<string, unknown>;
}): ScorerEval<TName> {
  return {
    kind: 'scorer',
    name: args.name,
    ...(args.description !== undefined
      ? { description: args.description }
      : {}),
    scorer: args.scorer,
    ...(args.verdict !== undefined ? { verdict: args.verdict } : {}),
    ...(args.context !== undefined ? { context: args.context } : {}),
    ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
  };
}
