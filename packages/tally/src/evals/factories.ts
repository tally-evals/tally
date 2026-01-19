/**
 * Eval Factory Functions
 *
 * Factory functions with "define" semantics and type inference
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
 * Define a single-turn eval with type inference
 * Verdict policy type is automatically inferred from metric value type
 */
export function defineSingleTurnEval<
  TContainer extends SingleTurnContainer,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TMetric extends SingleTurnMetricDef<any, TContainer>,
  // Infer raw value type from the provided metric, mirroring defineInput pattern
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TMetricValue extends MetricScalar = TMetric extends SingleTurnMetricDef<
    infer T,
    any
  >
    ? T
    : MetricScalar,
>(args: {
  name: string;
  description?: string;
  metric: TMetric;
  verdict?: VerdictPolicyFor<TMetricValue>;
  autoNormalize?: AutoNormalizer;
  context?: EvaluationContext;
  metadata?: Record<string, unknown>;
}): SingleTurnEval<TContainer, TMetricValue> {
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
 * Define a multi-turn eval with type inference
 * Verdict policy type is automatically inferred from metric value type
 */
export function defineMultiTurnEval<
  TContainer extends MultiTurnContainer,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TMetric extends MultiTurnMetricDef<any, TContainer>,
  // Infer raw value type from the provided metric, mirroring defineInput pattern
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TMetricValue extends MetricScalar = TMetric extends MultiTurnMetricDef<
    infer T,
    any
  >
    ? T
    : MetricScalar,
>(args: {
  name: string;
  description?: string;
  metric: TMetric;
  verdict?: VerdictPolicyFor<TMetricValue>;
  autoNormalize?: AutoNormalizer;
  context?: EvaluationContext;
  metadata?: Record<string, unknown>;
}): MultiTurnEval<TContainer, TMetricValue> {
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
 * Define a scorer eval
 * Verdict policy is always number-based (Score output)
 */
export function defineScorerEval(args: {
  name: string;
  description?: string;
  scorer: Scorer;
  verdict?: VerdictPolicyFor<number>;
  context?: EvaluationContext;
  metadata?: Record<string, unknown>;
}): ScorerEval {
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
